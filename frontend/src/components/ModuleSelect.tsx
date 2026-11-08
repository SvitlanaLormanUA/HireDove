import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './module-select.css'

interface Option { value: string; label: string }
interface Props {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  compact?: boolean
}

/** Select-only combobox for Admin/Notifications controls; focus stays on the trigger. */
export function ModuleSelect({ label, value, options, onChange, compact = false }: Props) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const search = useRef({ text: '', time: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = Math.max(0, options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('focusin', closeOutside)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('focusin', closeOutside)
    }
  }, [open])

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function choose(index: number) {
    if (!options[index]) return
    if (options[index].value !== value) onChange(options[index].value)
    setOpen(false)
    search.current.text = ''
    trigger.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (Date.now() - search.current.time > 700) search.current.text = ''
    if (event.key === 'Tab') {
      if (open && options[active] && options[active].value !== value) onChange(options[active].value)
      setOpen(false)
      return
    }
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
      search.current.text = ''
      return
    }
    if (event.key === 'Enter' || (event.key === ' ' && !search.current.text)) {
      event.preventDefault()
      if (open) choose(active)
      else { setActive(selected); setOpen(true) }
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) {
      event.preventDefault()
      search.current.text = ''
      if (event.altKey && event.key === 'ArrowUp' && open) { choose(active); return }
      const current = open ? active : selected
      const step = event.key === 'PageDown' ? 5 : event.key === 'PageUp' ? -5 : event.key === 'ArrowDown' ? 1 : -1
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
        : Math.min(options.length - 1, Math.max(0, current + step))
      setActive(open || ['Home', 'End', 'PageDown', 'PageUp'].includes(event.key) ? next : selected)
      setOpen(true)
      return
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      const now = Date.now()
      const text = (now - search.current.time > 700 ? '' : search.current.text) + event.key.toLocaleLowerCase('uk-UA')
      search.current = { text, time: now }
      // Repeated letters cycle matching options, as on native selects.
      const repeating = [...text].every(character => character === text[0])
      const prefix = repeating ? text[0] : text
      const start = open ? active : selected
      const order = options.map((_, index) => (start + (repeating ? 1 : 0) + index) % options.length)
      const match = order.find(index => options[index].label.toLocaleLowerCase('uk-UA').startsWith(prefix))
      if (match !== undefined) {
        setActive(match)
        if (!open && options[match].value !== value) onChange(options[match].value)
      }
    }
  }

  return <div ref={root} className={`module-select-field${compact ? ' module-select-field--compact' : ''}`}>
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    <div className="module-select">
      <button ref={trigger} id={id} type="button" className="module-select-trigger" role="combobox"
        aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onKeyDown={onKeyDown} onClick={() => { setActive(selected); search.current.text = ''; setOpen(!open) }}>
        <span id={`${id}-value`}>{options[selected]?.label}</span>
        <svg className="module-select-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <ul ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="module-select-list">
        {options.map((option, index) => <li key={option.value} id={`${id}-option-${index}`} role="option"
          aria-selected={option.value === value} className={`module-select-option${active === index ? ' is-active' : ''}`}
          onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <span>{option.label}</span>
          {option.value === value && <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>}
        </li>)}
      </ul>}
    </div>
  </div>
}
