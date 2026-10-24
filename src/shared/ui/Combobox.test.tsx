import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import { Combobox } from './Combobox'

interface Item {
  id: number
  name: string
}

const ITEMS: Item[] = [
  { id: 1, name: 'Olma' },
  { id: 2, name: 'Nok' },
  { id: 3, name: 'Uzum' },
]

function Harness({ onSearch }: { onSearch?: (t: string) => void }) {
  const [value, setValue] = useState<Item | null>(null)
  const [query, setQuery] = useState('')
  const options = ITEMS.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <>
      <Combobox
        value={value}
        onChange={setValue}
        options={options}
        getKey={(i) => i.id}
        getLabel={(i) => i.name}
        onInputChange={(t) => {
          setQuery(t)
          onSearch?.(t)
        }}
        aria-label="meva"
      />
      <output data-testid="value">{value?.name ?? ''}</output>
    </>
  )
}

describe('Combobox', () => {
  it('qidiradi va klaviatura bilan tanlaydi', () => {
    const onSearch = vi.fn()
    render(<Harness onSearch={onSearch} />)
    const input = screen.getByRole('combobox', { name: 'meva' })
    fireEvent.focus(input)
    expect(screen.getAllByRole('option')).toHaveLength(3)

    fireEvent.change(input, { target: { value: 'u' } })
    expect(onSearch).toHaveBeenLastCalledWith('u')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Uzum'])

    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('value').textContent).toBe('Nok')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect((input as HTMLInputElement).value).toBe('Nok')
  })

  it('sichqoncha bilan tanlash va Esc', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.click(screen.getByText('Uzum'))
    expect(screen.getByTestId('value').textContent).toBe('Uzum')

    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('topilmasa xabar', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByRole('listbox').textContent).toBe('Topilmadi')
  })
})
