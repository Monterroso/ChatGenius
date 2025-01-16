import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchResultsPopup from '@/components/SearchResultsPopup'
import type { SearchResult } from '@/types/db'

describe('SearchResultsPopup', () => {
  const mockResults: SearchResult[] = [
    {
      id: '1',
      content: 'Test message 1',
      created_at: new Date().toISOString(),
      sender_id: 'user1',
      sender: {
        id: 'user1',
        name: 'Test User 1',
        username: 'testuser1',
        image: undefined
      },
      group_id: null,
      receiver_id: 'user2'
    },
    {
      id: '2',
      content: 'Test message 2',
      created_at: new Date().toISOString(),
      sender_id: 'user2',
      sender: {
        id: 'user2',
        name: 'Test User 2',
        username: 'testuser2',
        image: undefined
      },
      group_id: 'group1',
      receiver_id: null
    }
  ]

  const mockOnClose = jest.fn()
  const mockOnMessageClick = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state correctly', () => {
    render(
      <SearchResultsPopup
        results={[]}
        isLoading={true}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByLabelText(/loading search results/i)).toBeInTheDocument()
  })

  it('renders no results message when there are no results', () => {
    render(
      <SearchResultsPopup
        results={[]}
        isLoading={false}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    expect(screen.getByText(/no messages found matching your search criteria/i)).toBeInTheDocument()
  })

  it('renders search results correctly', () => {
    render(
      <SearchResultsPopup
        results={mockResults}
        isLoading={false}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Test message 1')).toBeInTheDocument()
    expect(screen.getByText('Test message 2')).toBeInTheDocument()
    expect(screen.getByText('Test User 1')).toBeInTheDocument()
    expect(screen.getByText('Test User 2')).toBeInTheDocument()
  })

  it('calls onMessageClick when a result is clicked', () => {
    render(
      <SearchResultsPopup
        results={mockResults}
        isLoading={false}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    const messageButtons = screen.getAllByRole('button')
    fireEvent.click(messageButtons[1]) // First message (index 0 is close button)
    expect(mockOnMessageClick).toHaveBeenCalledWith(mockResults[0])
  })

  it('calls onClose when close button is clicked', () => {
    render(
      <SearchResultsPopup
        results={mockResults}
        isLoading={false}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /close search results/i }))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('displays group indicator for group messages', () => {
    render(
      <SearchResultsPopup
        results={[mockResults[1]]}
        isLoading={false}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    expect(screen.getByText(/in group chat/i)).toBeInTheDocument()
  })

  it('displays file attachment indicator for file messages', () => {
    const fileMessage: SearchResult = {
      ...mockResults[0],
      content: 'FILE:{"name":"test.txt","size":1024}'
    }

    render(
      <SearchResultsPopup
        results={[fileMessage]}
        isLoading={false}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    expect(screen.getByLabelText(/file attachment/i)).toBeInTheDocument()
  })

  it('handles keyboard navigation for message selection', () => {
    render(
      <SearchResultsPopup
        results={mockResults}
        isLoading={false}
        onClose={mockOnClose}
        onMessageClick={mockOnMessageClick}
      />
    )

    const messageButtons = screen.getAllByRole('button')
    fireEvent.keyDown(messageButtons[1], { key: 'Enter' })
    expect(mockOnMessageClick).toHaveBeenCalledWith(mockResults[0])

    fireEvent.keyDown(messageButtons[2], { key: ' ' })
    expect(mockOnMessageClick).toHaveBeenCalledWith(mockResults[1])
  })
}) 