import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBar from '@/components/SearchBar'
import type { DBGroup, SafeUser } from '@/types/db'

describe('SearchBar', () => {
  const mockOnSearch = jest.fn()
  const mockGroups: DBGroup[] = [
    { id: 'group1', name: 'Test Group 1', created_at: new Date().toISOString(), is_primary: false },
    { id: 'group2', name: 'Test Group 2', created_at: new Date().toISOString(), is_primary: false },
  ]
  const mockUsers: SafeUser[] = [
    { 
      id: 'user1', 
      name: 'Test User 1', 
      username: 'testuser1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_seen: new Date(),
      status: null
    },
    { 
      id: 'user2', 
      name: 'Test User 2', 
      username: 'testuser2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_seen: new Date(),
      status: null
    },
  ]
  const currentUserId = 'currentUser'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders search input and filters', () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        groups={mockGroups}
        users={mockUsers}
        currentUserId={currentUserId}
      />
    )

    expect(screen.getByLabelText(/search messages/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter by group/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter by sender/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/filter by recipient/i)).toBeInTheDocument()
  })

  it('calls onSearch with correct parameters when searching', async () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        groups={mockGroups}
        users={mockUsers}
        currentUserId={currentUserId}
      />
    )

    const searchInput = screen.getByLabelText(/search messages/i)
    await userEvent.type(searchInput, 'test message')
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    expect(mockOnSearch).toHaveBeenCalledWith('test message', {})
  })

  it('includes group filter in search', async () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        groups={mockGroups}
        users={mockUsers}
        currentUserId={currentUserId}
      />
    )
    
    // Select a group
    const groupSelect = screen.getByLabelText(/filter by group/i)
    fireEvent.change(groupSelect, { target: { value: 'group1' } })

    // Perform search
    const searchInput = screen.getByLabelText(/search messages/i)
    await userEvent.type(searchInput, 'test message')
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    expect(mockOnSearch).toHaveBeenCalledWith('test message', {
      groupId: 'group1'
    })
  })

  it('includes user filters in search', async () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        groups={mockGroups}
        users={mockUsers}
        currentUserId={currentUserId}
      />
    )
    
    // Select "from" user
    const fromSelect = screen.getByLabelText(/filter by sender/i)
    fireEvent.change(fromSelect, { target: { value: 'user1' } })

    // Select "to" user
    const toSelect = screen.getByLabelText(/filter by recipient/i)
    fireEvent.change(toSelect, { target: { value: 'user2' } })

    // Perform search
    const searchInput = screen.getByLabelText(/search messages/i)
    await userEvent.type(searchInput, 'test message')
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    expect(mockOnSearch).toHaveBeenCalledWith('test message', {
      fromUserId: 'user1',
      toUserId: 'user2'
    })
  })

  it('triggers search on Enter key', async () => {
    render(
      <SearchBar
        onSearch={mockOnSearch}
        groups={mockGroups}
        users={mockUsers}
        currentUserId={currentUserId}
      />
    )

    const searchInput = screen.getByLabelText(/search messages/i)
    await userEvent.type(searchInput, 'test message{enter}')

    expect(mockOnSearch).toHaveBeenCalledWith('test message', {})
  })
}) 