import { supabase } from './lib/supabase'

type ServiceTypeRow = {
  id: string
  name: string
  description: string | null
  default_start: string | null
  default_end: string | null
  active: boolean
}

let services: ServiceTypeRow[] = []
let observer: MutationObserver | null = null

async function isCurrentUserAdmin() {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return false

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return data?.role === 'admin'
}

async function loadServices() {
  const { data } = await supabase
    .from('service_types')
    .select('id, name, description, default_start, default_end, active')
    .order('name')

  services = (data ?? []) as ServiceTypeRow[]
}

function normalizeTime(value: string | null) {
  return value ? value.slice(0, 5) : ''
}

async function editService(service: ServiceTypeRow) {
  const name = window.prompt('Nome do serviço:', service.name)
  if (name === null) return

  const description = window.prompt('Descrição:', service.description ?? '')
  if (description === null) return

  const start = window.prompt('Horário de início (HH:MM):', normalizeTime(service.default_start))
  if (start === null) return

  const end = window.prompt('Horário de fim (HH:MM):', normalizeTime(service.default_end))
  if (end === null) return

  if (!name.trim()) {
    window.alert('O nome do serviço não pode ficar vazio.')
    return
  }

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
  if ((start && !timePattern.test(start)) || (end && !timePattern.test(end))) {
    window.alert('Use horários no formato HH:MM, por exemplo 08:00.')
    return
  }

  const { error } = await supabase
    .from('service_types')
    .update({
      name: name.trim(),
      description: description.trim() || null,
      default_start: start || null,
      default_end: end || null,
    })
    .eq('id', service.id)

  if (error) {
    window.alert(`Não foi possível alterar o serviço: ${error.message}`)
    return
  }

  window.location.reload()
}

async function deleteService(service: ServiceTypeRow) {
  const { count, error: countError } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('service_type_id', service.id)

  if (countError) {
    window.alert(`Não foi possível verificar o uso do serviço: ${countError.message}`)
    return
  }

  if ((count ?? 0) > 0) {
    const confirmed = window.confirm(
      `“${service.name}” já foi usado em ${count} escala(s). Para preservar o histórico, ele será desativado em vez de apagado. Deseja continuar?`,
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('service_types')
      .update({ active: false })
      .eq('id', service.id)

    if (error) {
      window.alert(`Não foi possível desativar o serviço: ${error.message}`)
      return
    }
  } else {
    const confirmed = window.confirm(`Excluir definitivamente o serviço “${service.name}”?`)
    if (!confirmed) return

    const { error } = await supabase
      .from('service_types')
      .delete()
      .eq('id', service.id)

    if (error) {
      window.alert(`Não foi possível excluir o serviço: ${error.message}`)
      return
    }
  }

  window.location.reload()
}

function enhanceServiceCards() {
  const cards = document.querySelectorAll<HTMLElement>('.service-card')

  cards.forEach((card) => {
    if (card.querySelector('.service-admin-actions')) return

    const title = card.querySelector('strong')?.textContent?.trim()
    if (!title) return

    const service = services.find((item) => item.name === title)
    if (!service) return

    const actions = document.createElement('div')
    actions.className = 'service-admin-actions row-actions'
    actions.style.marginTop = '14px'
    actions.style.paddingTop = '12px'
    actions.style.borderTop = '1px solid #e7ebe8'

    const editButton = document.createElement('button')
    editButton.type = 'button'
    editButton.className = 'small-button'
    editButton.textContent = 'Editar'
    editButton.addEventListener('click', () => void editService(service))

    const deleteButton = document.createElement('button')
    deleteButton.type = 'button'
    deleteButton.className = 'small-button service-delete-button'
    deleteButton.textContent = 'Excluir'
    deleteButton.style.color = '#a94442'
    deleteButton.style.background = '#f7e6e5'
    deleteButton.addEventListener('click', () => void deleteService(service))

    actions.append(editButton, deleteButton)
    card.appendChild(actions)
  })
}

async function initialize() {
  if (!(await isCurrentUserAdmin())) return
  await loadServices()
  enhanceServiceCards()

  observer = new MutationObserver(() => enhanceServiceCards())
  observer.observe(document.body, { childList: true, subtree: true })
}

void initialize()

supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN') void initialize()
  if (event === 'SIGNED_OUT') observer?.disconnect()
})
