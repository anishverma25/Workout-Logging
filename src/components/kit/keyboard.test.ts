import { keyboardInset, viewportBaseline } from './keyboard';

describe('keyboardInset', () => {
  it('is the part of the window the keyboard covers on iPhone', () => {
    // An iPhone 13 window of 844 with a 336 high keyboard: the visual viewport is 508.
    expect(keyboardInset(844, { height: 508, offsetTop: 0 })).toBe(336);
    // Scrolled while the keyboard is open: the offset is part of what is still visible.
    expect(keyboardInset(844, { height: 508, offsetTop: 40 })).toBe(296);
  });

  it('is 0 where the browser resizes the window for the keyboard, or without one', () => {
    // Android with interactive-widget=resizes-content: the window itself shrinks.
    expect(keyboardInset(508, { height: 508, offsetTop: 0 })).toBe(0);
    // The address bar showing or hiding is not a keyboard.
    expect(keyboardInset(844, { height: 790, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(844, null)).toBe(0);
  });

  it('ignores the browser toolbars that newer iPhones take out of the visual viewport', () => {
    // A window of 874 whose visual viewport is 760 before any keyboard: baseline 114.
    const base = viewportBaseline(874, { height: 760, offsetTop: 0 });
    expect(base).toBe(114);
    expect(keyboardInset(874, { height: 760, offsetTop: 0 }, base)).toBe(0);
    // The keyboard then takes 336 more: only that is the keyboard.
    expect(keyboardInset(874, { height: 424, offsetTop: 0 }, base)).toBe(336);
  });
});
