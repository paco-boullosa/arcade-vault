"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import type { TouchConfig } from "../lib/games/registry";
import { createKeyHold } from "../lib/games/touch";

type HoldButtonProps = {
  code: string;
  repeat?: boolean; // solo la cruz repite
  className: string;
  label: string; // nombre accesible
  disabled?: boolean; // atenuado: no envía nada
  children: ReactNode;
};

// Botón que mantiene una tecla sintética mientras el puntero esté pulsado.
function HoldButton({
  code,
  repeat = false,
  className,
  label,
  disabled = false,
  children,
}: HoldButtonProps) {
  const releaseRef = useRef<() => void>(() => {});
  const pressRef = useRef<() => void>(() => {});

  useEffect(() => {
    const hold = createKeyHold(code, { repeat });
    pressRef.current = hold.press;
    releaseRef.current = hold.release;
    const onHidden = () => {
      if (document.hidden) hold.release();
    };
    window.addEventListener("blur", hold.release);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("blur", hold.release);
      document.removeEventListener("visibilitychange", onHidden);
      // Libera la tecla y cancela el temporizador al desmontar.
      hold.release();
      pressRef.current = () => {};
      releaseRef.current = () => {};
    };
  }, [code, repeat]);

  return (
    <button
      type="button"
      className={`touch-btn ${className}`}
      aria-label={label}
      disabled={disabled}
      tabIndex={-1}
      onPointerDown={
        disabled
          ? undefined
          : (e) => {
              e.preventDefault();
              // El puntero queda capturado: el dedo puede salir del botón sin soltarlo.
              e.currentTarget.setPointerCapture(e.pointerId);
              pressRef.current();
            }
      }
      onPointerUp={() => releaseRef.current()}
      onPointerCancel={() => releaseRef.current()}
      onLostPointerCapture={() => releaseRef.current()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

type TouchControlsProps = {
  touch: TouchConfig;
  paused: boolean;
  onTogglePause: (e: MouseEvent<HTMLButtonElement>) => void;
  onFinish: (e: MouseEvent<HTMLButtonElement>) => void;
  exitHref: string;
};

export default function TouchControls({
  touch,
  paused,
  onTogglePause,
  onFinish,
  exitHref,
}: TouchControlsProps) {
  const { dpad, a, b, skin, extras } = touch;

  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-bar">
        <button
          type="button"
          className="touch-btn touch-bar-btn"
          tabIndex={-1}
          onClick={onTogglePause}
        >
          {paused ? "REANUDAR" : "PAUSA"}
        </button>
        <HoldButton code={skin} className="touch-bar-btn" label="Cambiar skin">
          SKIN
        </HoldButton>
        {extras?.map((x) => (
          <HoldButton
            key={x.code}
            code={x.code}
            className="touch-bar-btn"
            label={x.label}
          >
            {x.label}
          </HoldButton>
        ))}
        <button
          type="button"
          className="touch-btn touch-bar-btn"
          tabIndex={-1}
          onClick={onFinish}
        >
          FIN
        </button>
        <Link href={exitHref} className="touch-btn touch-bar-btn" tabIndex={-1}>
          SALIR
        </Link>
      </div>
      <div className="touch-pad">
        <div className="touch-dpad">
          <HoldButton
            code="ArrowUp"
            repeat
            className="touch-dpad-btn touch-up"
            label="Arriba"
            disabled={!dpad.up}
          >
            ↑
          </HoldButton>
          <HoldButton
            code="ArrowLeft"
            repeat
            className="touch-dpad-btn touch-left"
            label="Izquierda"
            disabled={!dpad.left}
          >
            ←
          </HoldButton>
          <HoldButton
            code="ArrowRight"
            repeat
            className="touch-dpad-btn touch-right"
            label="Derecha"
            disabled={!dpad.right}
          >
            →
          </HoldButton>
          <HoldButton
            code="ArrowDown"
            repeat
            className="touch-dpad-btn touch-down"
            label="Abajo"
            disabled={!dpad.down}
          >
            ↓
          </HoldButton>
        </div>
        <div className="touch-actions">
          {b ? (
            <HoldButton
              code={b.code}
              className="touch-action-btn touch-b"
              label={b.label}
            >
              {b.label}
            </HoldButton>
          ) : (
            // Sin B en este juego: se mantiene el hueco, atenuado y sin acción.
            <HoldButton
              code="none"
              className="touch-action-btn touch-b"
              label="B (sin acción)"
              disabled
            >
              B
            </HoldButton>
          )}
          <HoldButton
            code={a.code}
            className="touch-action-btn touch-a"
            label={a.label}
          >
            {a.label}
          </HoldButton>
        </div>
      </div>
    </div>
  );
}
