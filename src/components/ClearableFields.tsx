import type { KeyboardEvent, Ref } from 'react'

function ClearButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="clear" aria-label="Clear" onClick={onClick} />
}

interface InputProps {
  value: string
  onChange?: (value: string) => void
  /** When given, an × button appears while the field has text. Omit for read-only fields. */
  onClear?: () => void
  readOnly?: boolean
  mono?: boolean
  placeholder: string
  ariaLabel: string
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  ref?: Ref<HTMLInputElement>
}

export function ClearableInput({
  value, onChange, onClear, readOnly, mono, placeholder, ariaLabel, onKeyDown, ref,
}: InputProps) {
  return (
    <div className="field">
      <input
        ref={ref}
        type="text"
        className={mono ? 'mono' : undefined}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onKeyDown={onKeyDown}
      />
      {onClear && value && <ClearButton onClick={onClear} />}
    </div>
  )
}

interface TextAreaProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder: string
  ariaLabel: string
  ref?: Ref<HTMLTextAreaElement>
}

export function ClearableTextArea({ value, onChange, onClear, placeholder, ariaLabel, ref }: TextAreaProps) {
  return (
    <div className="field">
      <textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && <ClearButton onClick={onClear} />}
    </div>
  )
}
