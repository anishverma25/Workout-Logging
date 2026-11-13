import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Crown, Download, ImagePlus, RotateCcw, Share } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { ButtonLink } from '@/components/ui/Button';
import {
  Chip,
  ChipGroup,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  Switch,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import {
  boxGeometry,
  CARD_H,
  CARD_W,
  DEFAULT_PLACEMENT,
  handlePoint,
  hitsBox,
  moveBox,
  presetBox,
  resizeBox,
  SIZE_MAX,
  SIZE_MIN,
  TILT_MAX,
  type BoxPlacement,
} from '@/domain/share/layout';
import type { StoryContent } from '@/domain/share/story';
import { cn } from '@/lib/cn';

/** Designs that need Pro to save or share: LED scoreboard, die-cut sticker, caption note, rings. */
const PRO_DESIGNS = new Set<DesignId>(['C', 'E', 'F', 'G']);
import { css, FONT_CHOICES, loadFamilies, type FontId } from './fonts';
import {
  ACCENTS,
  DESIGNS,
  familiesFor,
  renderStory,
  type Background,
  type DesignId,
  type RenderResult,
  type StoryPhoto,
  type StoryStyle,
} from './render';
import { loadStyle, saveStyle } from './styleStore';

/**
 * The story card editor (share cards 2.0): the card as it will be saved, with the stats box
 * the person drags anywhere, resizes by its corner handle, a pinch or the Size slider, and
 * styles with the controls below. The same drawing is saved, so what they see is what posts.
 * The photo is read on the phone and never leaves it.
 */

const BACKGROUNDS: { id: Exclude<Background, 'photo'>; label: string; css: string }[] = [
  {
    id: 'bg1',
    label: 'Lime glow',
    css: 'radial-gradient(70% 60% at 50% 30%,rgba(210,242,92,.55),transparent 70%),#0a0b08',
  },
  {
    id: 'bg2',
    label: 'Aurora',
    css: 'radial-gradient(60% 50% at 20% 20%,rgba(124,92,255,.8),transparent 70%),radial-gradient(60% 50% at 85% 70%,rgba(60,200,255,.7),transparent 70%),#080a12',
  },
  {
    id: 'bg3',
    label: 'Dusk',
    css: 'radial-gradient(70% 55% at 70% 25%,rgba(255,176,90,.8),transparent 70%),radial-gradient(60% 55% at 20% 75%,rgba(255,80,110,.6),transparent 70%),#120a0c',
  },
  {
    id: 'bg4',
    label: 'Grid',
    css: 'linear-gradient(rgba(255,255,255,.14) 1px,transparent 1px) 0 0/8px 8px,linear-gradient(90deg,rgba(255,255,255,.14) 1px,transparent 1px) 0 0/8px 8px,#0a0b08',
  },
];

/** Reads a chosen photo, upright, no larger than twice the card, kept in memory only. */
async function readPhoto(file: File): Promise<StoryPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo.');
  let source: CanvasImageSource;
  let w: number;
  let h: number;
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      source = bitmap;
      w = bitmap.width;
      h = bitmap.height;
    } catch {
      throw new Error('That file is not a photo we can open. Try a JPEG or PNG.');
    }
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      source = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    } catch {
      throw new Error('That file is not a photo we can open. Try a JPEG or PNG.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  // Large phone photos are scaled down once so dragging stays smooth.
  const k = Math.min(1, (CARD_H * 1.5) / Math.max(w, h * (CARD_W / CARD_H)));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot open photos here.');
  ctx.drawImage(source, 0, 0, cw, ch);
  if ('close' in source && typeof source.close === 'function') source.close();
  return { image: canvas, width: cw, height: ch };
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="type-meta flex justify-between text-text-2">
        <span>{label}</span>
        <span className="tabular text-text-1">
          {value}
          {suffix}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--lime)]"
      />
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <h3 className="type-label mb-2 text-text-2">{children}</h3>;
}

export function StoryEditor({
  content,
  name,
  fileName,
}: {
  content: StoryContent;
  /** First name for the date line; null hides the switch. */
  name: string | null;
  fileName: string;
}) {
  const toast = useToast();
  const [style, setStyleState] = useState<StoryStyle>(() => loadStyle());
  // Four designs are Pro: free members can try them on their own card, and save the free ones.
  const proDesigns = useFeature('story_designs');
  const designLocked = !proDesigns && PRO_DESIGNS.has(style.design);
  const [photo, setPhoto] = useState<StoryPhoto | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(0);
  const [guides, setGuides] = useState(false);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const last = useRef<RenderResult | null>(null);
  const frame = useRef(0);
  const styleRef = useRef(style);
  useLayoutEffect(() => {
    styleRef.current = style;
  }, [style]);

  const setStyle = useCallback((next: StoryStyle | ((s: StoryStyle) => StoryStyle)) => {
    setStyleState((s) => {
      const v = typeof next === 'function' ? next(s) : next;
      saveStyle(v);
      return v;
    });
  }, []);
  const setPlacement = useCallback(
    (p: BoxPlacement) => setStyle((s) => ({ ...s, placement: p })),
    [setStyle],
  );

  // Fonts for the chosen design and font, loaded as they are needed.
  const families = familiesFor(style).join(',');
  useEffect(() => {
    let live = true;
    void loadFamilies(families.split(',') as never).then(() => {
      if (live) setFontsReady((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [families]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    last.current = renderStory(
      ctx,
      { content, style: styleRef.current, photo, name },
      { editing: true, guides },
    );
    // The round resize handle follows the box's corner.
    const handle = handleRef.current;
    const rect = canvas.getBoundingClientRect();
    if (handle && rect.width) {
      const k = rect.width / CARD_W;
      const pt = handlePoint(last.current.geometry, styleRef.current.placement.tilt);
      handle.style.transform = `translate(${pt.x * k}px, ${pt.y * k}px) translate(-50%, -50%)`;
    }
  }, [content, photo, name, guides]);

  useLayoutEffect(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame.current);
  }, [draw, style, fontsReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  // Dragging, the corner handle and pinching, in card pixels.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'move'; x: number; y: number; from: BoxPlacement }
    | { kind: 'resize'; ox: number; oy: number; d: number; from: BoxPlacement }
    | { kind: 'pinch'; d: number; from: BoxPlacement }
    | null
  >(null);

  const toCard = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const k = CARD_W / rect.width;
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  };
  const natural = () => ({ w0: last.current?.w0 ?? 1, h0: last.current?.h0 ?? 1 });

  function onDown(e: PointerEvent<HTMLElement>, onHandle: boolean) {
    const r = last.current;
    if (!r) return;
    const pt = toCard(e);
    const from = styleRef.current.placement;
    if (!onHandle && pointers.current.size === 0 && !hitsBox(r.geometry, from.tilt, pt.x, pt.y, 24))
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
    pointers.current.set(e.pointerId, pt);
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, from };
      return;
    }
    if (onHandle) {
      // The handle resizes from the opposite (top-left) corner, which stays put.
      const g = boxGeometry(from, r.w0, r.h0);
      const a = (from.tilt * Math.PI) / 180;
      const cx = g.left + g.w / 2;
      const cy = g.top + g.h / 2;
      const ox = cx - (g.w / 2) * Math.cos(a) + (g.h / 2) * Math.sin(a);
      const oy = cy - (g.w / 2) * Math.sin(a) - (g.h / 2) * Math.cos(a);
      gesture.current = { kind: 'resize', ox, oy, d: Math.hypot(pt.x - ox, pt.y - oy) || 1, from };
      return;
    }
    gesture.current = { kind: 'move', x: pt.x, y: pt.y, from };
  }

  function onMove(e: PointerEvent<HTMLElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    const pt = toCard(e);
    pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    if (!g) return;
    const { w0, h0 } = natural();
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      setPlacement(resizeBox(g.from, (g.from.size * d) / g.d, 'centre', w0, h0));
    } else if (g.kind === 'resize') {
      const d = Math.hypot(pt.x - g.ox, pt.y - g.oy);
      setPlacement(resizeBox(g.from, (g.from.size * d) / g.d, 'corner', w0, h0));
    } else if (g.kind === 'move') {
      setPlacement(moveBox(g.from, pt.x - g.x, pt.y - g.y, w0, h0));
    }
  }

  function onUp(e: PointerEvent<HTMLElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    else if (pointers.current.size === 1 && gesture.current?.kind === 'pinch') {
      const [p] = [...pointers.current.values()];
      gesture.current = { kind: 'move', x: p!.x, y: p!.y, from: styleRef.current.placement };
    }
  }

  function onKey(e: KeyboardEvent<HTMLElement>) {
    const { w0, h0 } = natural();
    const p = styleRef.current.placement;
    const step = e.shiftKey ? 80 : 20;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      setPlacement(moveBox(p, m[0], m[1], w0, h0));
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      setPlacement(resizeBox(p, p.size + 5, 'centre', w0, h0));
    } else if (e.key === '-') {
      e.preventDefault();
      setPlacement(resizeBox(p, p.size - 5, 'centre', w0, h0));
    }
  }

  async function makeImage(): Promise<Blob | null> {
    await loadFamilies(familiesFor(style));
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    renderStory(ctx, { content, style, photo, name }, {});
    return new Promise((r) => canvas.toBlob(r, 'image/png'));
  }

  const canShare =
    typeof navigator.share === 'function' && typeof navigator.canShare === 'function';

  async function share() {
    setBusy(true);
    try {
      const blob = await makeImage();
      if (!blob) throw new Error('no image');
      const file = new File([blob], fileName, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        // The image only: Instagram drops shares that carry text with the file.
        await navigator.share({ files: [file] });
      } else download(blob);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError'))
        toast('Could not open sharing. Save the image and post it from your gallery.');
    } finally {
      setBusy(false);
    }
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Image saved');
  }

  async function save() {
    setBusy(true);
    try {
      const blob = await makeImage();
      if (blob) download(blob);
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const p = await readPhoto(file);
      setPhoto(p);
      setThumb((p.image as HTMLCanvasElement).toDataURL('image/jpeg', 0.3));
      setStyle((s) => ({ ...s, background: 'photo' }));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open that photo.');
    }
  }

  const p = style.placement;

  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex justify-center">
        <div className="relative w-[min(17rem,64vw)] supports-[height:1dvh]:max-w-[calc(46dvh*9/16)]">
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            tabIndex={0}
            role="img"
            aria-label={`Your ${content.title} story card. Drag the stats to move them; arrow keys move, plus and minus resize.`}
            data-story-canvas
            className="block aspect-[9/16] w-full touch-none rounded-nested bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-lime"
            onPointerDown={(e) => onDown(e, false)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          />
          <div
            ref={handleRef}
            role="presentation"
            data-story-handle
            title="Drag to resize"
            onPointerDown={(e) => onDown(e, true)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="absolute top-0 left-0 grid size-8 touch-none place-items-center rounded-full bg-text-1 text-bg shadow-lg"
          >
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
              <path
                d="M3 13 L13 3 M8 3 H13 V8 M3 8 V13 H8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
      <p className="type-meta -mt-2 text-center text-text-2">
        Drag the stats anywhere. Pull the round handle or pinch to resize.
      </p>

      <section>
        <Label>Design</Label>
        <ChipGroup
          label="Design"
          scroll
          value={style.design}
          onChange={(v: DesignId) => setStyle((s) => ({ ...s, design: v }))}
          options={DESIGNS.map((d) => ({
            value: d.id,
            label: !proDesigns && PRO_DESIGNS.has(d.id) ? `${d.name} · Pro` : d.name,
          }))}
        />
      </section>

      <section>
        <Label>Background</Label>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className={cn(
              'pressable chrome type-meta relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 font-semibold',
              style.background === 'photo' && photo
                ? 'bg-lime text-on-lime'
                : 'bg-surface-2 text-text-1',
            )}
          >
            <ImagePlus className="size-4" aria-hidden />
            {photo ? 'Change photo' : 'Your photo'}
            <input
              type="file"
              accept="image/*"
              data-story-photo
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                void pickPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {photo ? (
            <button
              type="button"
              aria-pressed={style.background === 'photo'}
              aria-label="Use your photo"
              onClick={() => setStyle((s) => ({ ...s, background: 'photo' }))}
              className={cn(
                'size-11 overflow-hidden rounded-xl border-2 bg-surface-2 bg-cover bg-center',
                style.background === 'photo' ? 'border-lime' : 'border-transparent',
              )}
              style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
            />
          ) : null}
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={style.background === b.id}
              aria-label={b.label}
              title={b.label}
              onClick={() => setStyle((s) => ({ ...s, background: b.id }))}
              className={cn(
                'size-11 rounded-xl border-2',
                style.background === b.id ? 'border-lime' : 'border-transparent',
              )}
              style={{ background: b.css }}
            />
          ))}
        </div>
        <p className="type-meta mt-2 text-text-2">
          Your photo stays on this phone. It is never uploaded.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <Slider
          id="story-size"
          label="Size"
          value={p.size}
          min={SIZE_MIN}
          max={SIZE_MAX}
          suffix="%"
          onChange={(v) => {
            const { w0, h0 } = natural();
            setPlacement(resizeBox(p, v, 'centre', w0, h0));
          }}
        />
        <Slider
          id="story-opacity"
          label="Box opacity"
          value={style.boxOpacity}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setStyle((s) => ({ ...s, boxOpacity: v }))}
        />
      </section>

      <section>
        <Label>Accent</Label>
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              aria-label={a.label}
              aria-pressed={style.accent === a.value}
              onClick={() => setStyle((s) => ({ ...s, accent: a.value }))}
              className={cn(
                'size-9 rounded-full border-2',
                style.accent === a.value ? 'border-text-1' : 'border-transparent',
              )}
              style={{
                background: a.value,
                boxShadow: style.accent === a.value ? 'inset 0 0 0 2px var(--bg)' : undefined,
              }}
            />
          ))}
        </div>
      </section>

      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore((m) => !m)}
        className="type-body -mt-1 self-start font-semibold text-lime"
      >
        {more ? 'Fewer options' : 'More options'}
      </button>

      {more ? (
        <div className="flex flex-col gap-5">
          <section>
            <Label>Font</Label>
            <div className="flex flex-wrap gap-2">
              <Chip
                selected={style.font === 'auto'}
                onClick={() => setStyle((s) => ({ ...s, font: 'auto' }))}
              >
                Design default
              </Chip>
              {FONT_CHOICES.map((f) => (
                <FontChip
                  key={f.id}
                  id={f.id}
                  label={f.label}
                  selected={style.font === f.id}
                  onPick={() => setStyle((s) => ({ ...s, font: f.id }))}
                />
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-4">
            <Slider
              id="story-tilt"
              label="Tilt"
              value={p.tilt}
              min={-TILT_MAX}
              max={TILT_MAX}
              suffix="°"
              onChange={(v) => setPlacement({ ...p, tilt: v })}
            />
            <Slider
              id="story-dim"
              label="Photo darkness"
              value={style.dim}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => setStyle((s) => ({ ...s, dim: v }))}
            />
          </section>
          <section>
            <Label>Move stats</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['Left', 'x', 0.05],
                  ['Centre', 'x', 0.5],
                  ['Right', 'x', 0.95],
                  ['Top', 'y', 0.08],
                  ['Middle', 'y', 0.5],
                  ['Bottom', 'y', 0.84],
                ] as const
              ).map(([label, axis, v]) => (
                <Chip
                  key={label}
                  toggle={false}
                  onClick={() => setPlacement(presetBox(p, axis, v))}
                >
                  {label}
                </Chip>
              ))}
              <Chip
                toggle={false}
                leading={<RotateCcw className="size-3.5" aria-hidden />}
                onClick={() => setPlacement(DEFAULT_PLACEMENT)}
              >
                Reset
              </Chip>
            </div>
          </section>
          <section className="grid gap-4">
            <div>
              <Label>Text colour</Label>
              <SegmentedControl
                label="Text colour"
                value={style.ink}
                onChange={(v) => setStyle((s) => ({ ...s, ink: v }))}
                options={[
                  { value: 'white', label: 'White' },
                  { value: 'black', label: 'Black' },
                ]}
                block
              />
            </div>
            <div>
              <Label>Brand and date</Label>
              <SegmentedControl
                label="Brand and date"
                value={style.brand}
                onChange={(v) => setStyle((s) => ({ ...s, brand: v }))}
                options={[
                  { value: 'top', label: 'Very top' },
                  { value: 'safe', label: 'Inside safe area' },
                ]}
                block
              />
            </div>
            <div>
              <Label>Brand size</Label>
              <SegmentedControl
                label="Brand size"
                value={style.brandSize}
                onChange={(v) => setStyle((s) => ({ ...s, brandSize: v }))}
                options={[
                  { value: 's', label: 'Small' },
                  { value: 'm', label: 'Medium' },
                  { value: 'l', label: 'Large' },
                ]}
                block
              />
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <Toggle
              label="Show tags and notes"
              checked={style.tags}
              onChange={(v) => setStyle((s) => ({ ...s, tags: v }))}
            />
            {name ? (
              <Toggle
                label="Show my name"
                checked={style.showName}
                onChange={(v) => setStyle((s) => ({ ...s, showName: v }))}
              />
            ) : null}
            <Toggle label="Show Instagram safe area" checked={guides} onChange={setGuides} />
          </section>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 pb-1">
        {designLocked ? (
          <div className="flex flex-col gap-2" data-design-locked>
            <ButtonLink to="/pro" size="lg" block>
              <Crown className="size-4" aria-hidden /> Unlock this design with Pro
            </ButtonLink>
            <SecondaryButton
              block
              onClick={() => setStyle((s) => ({ ...s, design: DESIGNS[0]!.id }))}
            >
              Use a free design
            </SecondaryButton>
          </div>
        ) : null}
        {!designLocked && canShare ? (
          <PrimaryButton
            block
            icon={<Share aria-hidden />}
            loading={busy}
            onClick={() => void share()}
          >
            Share
          </PrimaryButton>
        ) : null}
        {!designLocked ? (
          <SecondaryButton
            block
            icon={<Download aria-hidden />}
            disabled={busy}
            onClick={() => void save()}
          >
            Save image
          </SecondaryButton>
        ) : null}
        <p className="type-meta text-center text-text-2">
          {canShare
            ? 'Pick Instagram and then Story, or WhatsApp and then My status.'
            : 'Save it, then add it to your Instagram story or WhatsApp status from your photos.'}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-body text-text-1">{label}</span>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}

/** A font choice shown in its own face once that face has loaded. */
function FontChip({
  id,
  label,
  selected,
  onPick,
}: {
  id: FontId;
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void loadFamilies([id]).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <Chip selected={selected} onClick={onPick}>
      <span style={ready ? { fontFamily: css(id) } : undefined}>{label}</span>
    </Chip>
  );
}
