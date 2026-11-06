import {
  EXPERIENCE_LABELS,
  WORK_FORMAT_LABELS,
  type CatalogFilters,
  type ExperienceLevel,
  type FilterOptions,
  type WorkFormat,
} from '../../api/vacancies'

interface Props {
  filters: CatalogFilters
  options: FilterOptions
  onChange: (patch: Partial<CatalogFilters>) => void
  onReset: () => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FiltersPanel({ filters, options, onChange, onReset }: Props) {
  return (
    <div className="filters">
      <div className="filter-group">
        <label htmlFor="f-location">Локація</label>
        <select id="f-location" value={filters.location} onChange={(e) => onChange({ location: e.target.value })}>
          <option value="">Усі</option>
          {options.locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="f-industry">Галузь</label>
        <select id="f-industry" value={filters.industry} onChange={(e) => onChange({ industry: e.target.value })}>
          <option value="">Усі</option>
          {options.industries.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </select>
      </div>

      <fieldset className="filter-group">
        <legend>Формат роботи</legend>
        {(Object.keys(WORK_FORMAT_LABELS) as WorkFormat[]).map((v) => (
          <label key={v} className="check">
            <input type="checkbox" checked={filters.workFormat.includes(v)}
              onChange={() => onChange({ workFormat: toggle(filters.workFormat, v) })} />
            {WORK_FORMAT_LABELS[v]}
          </label>
        ))}
      </fieldset>

      <fieldset className="filter-group">
        <legend>Досвід</legend>
        {(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map((v) => (
          <label key={v} className="check">
            <input type="checkbox" checked={filters.experience.includes(v)}
              onChange={() => onChange({ experience: toggle(filters.experience, v) })} />
            {EXPERIENCE_LABELS[v]}
          </label>
        ))}
      </fieldset>

      <button type="button" className="link-button" onClick={onReset}>Скинути фільтри</button>
    </div>
  )
}
