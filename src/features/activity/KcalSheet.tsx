import { useState } from 'react';
import { BottomSheet, NumberField, PrimaryButton, SecondaryButton } from '@/components/kit';

/**
 * Type the calories burned from a watch, tracker, app or machine. Saving a number replaces our
 * estimate; "Use the estimate" removes it again.
 */
export function KcalSheet({
  open,
  onClose,
  title,
  initial,
  onSave,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: number | null;
  onSave: (kcal: number) => Promise<void>;
  /** Present when a typed number can be removed to go back to the estimate. */
  onClear?: () => Promise<void>;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {open ? <Body initial={initial} onSave={onSave} onClear={onClear} /> : null}
    </BottomSheet>
  );
}

function Body({
  initial,
  onSave,
  onClear,
}: {
  initial: number | null;
  onSave: (kcal: number) => Promise<void>;
  onClear?: () => Promise<void>;
}) {
  const [kcal, setKcal] = useState<number | null>(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-4 pt-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (kcal === null) return;
        setBusy(true);
        await onSave(Math.round(kcal));
        setBusy(false);
      }}
    >
      <p className="type-body text-text-2">
        Enter the active calories your watch, tracker, app or machine shows, if you trust it. It
        replaces the estimate.
      </p>
      <NumberField
        label="Calories burned"
        value={kcal}
        onValueChange={setKcal}
        allowDecimal={false}
        min={0}
        max={10000}
        unit="kcal"
        autoFocus
      />
      <div className="flex flex-col gap-2">
        <PrimaryButton block type="submit" loading={busy} disabled={kcal === null}>
          Save
        </PrimaryButton>
        {onClear ? (
          <SecondaryButton
            block
            onClick={async () => {
              setBusy(true);
              await onClear();
              setBusy(false);
            }}
          >
            Use the estimate instead
          </SecondaryButton>
        ) : null}
      </div>
    </form>
  );
}
