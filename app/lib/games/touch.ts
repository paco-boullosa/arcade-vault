// Teclas sintéticas para el mando táctil. Los motores escuchan `keydown` y
// `keyup` en `window` y leen `e.code`, así que el mando solo envía esos eventos.

// Equivalente a mantener una tecla pulsada: primer paso inmediato, repetición
// tras `delayMs` y luego cada `intervalMs`.
export const TOUCH_REPEAT = { delayMs: 250, intervalMs: 70 };

export function sendKey(
  type: "keydown" | "keyup",
  code: string,
  repeat = false,
): void {
  // El objetivo es `window`, no un button o input, para pasar `isIgnoredTarget`.
  window.dispatchEvent(
    new KeyboardEvent(type, { code, bubbles: true, cancelable: true, repeat }),
  );
}

export type KeyHold = {
  press: () => void;
  release: () => void;
};

// Una tecla mantenida. `press()` y `release()` son idempotentes. Con
// `repeat: true` (solo la cruz) envía `keydown` repetidos mientras siga pulsada.
export function createKeyHold(
  code: string,
  { repeat }: { repeat: boolean },
): KeyHold {
  let down = false;
  let delayTimer: ReturnType<typeof setTimeout> | undefined;
  let repeatTimer: ReturnType<typeof setInterval> | undefined;

  const clearTimers = () => {
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
    delayTimer = undefined;
    repeatTimer = undefined;
  };

  return {
    press() {
      if (down) return;
      down = true;
      sendKey("keydown", code);
      if (!repeat) return;
      delayTimer = setTimeout(() => {
        // Primera repetición justo al cumplirse `delayMs`, como el teclado.
        sendKey("keydown", code, true);
        repeatTimer = setInterval(
          () => sendKey("keydown", code, true),
          TOUCH_REPEAT.intervalMs,
        );
      }, TOUCH_REPEAT.delayMs);
    },
    release() {
      if (!down) return;
      down = false;
      clearTimers();
      sendKey("keyup", code);
    },
  };
}
