import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OrderTable } from '@/components/OrderTable';
import { PreferencesProvider } from '@/components/PreferencesProvider';
import { mockOrder, mockOrders, mockCancelledOrder } from '../fixtures/orders';

function renderWithProviders(ui: React.ReactElement, currency: 'EUR' | 'GBP' | 'USD' = 'EUR') {
  return render(<PreferencesProvider initialCurrency={currency}>{ui}</PreferencesProvider>);
}

describe('OrderTable', () => {

  // ── Empty state ───────────────────────────────────────────────────────────

  it('shows empty state message when orders array is empty', () => {
    renderWithProviders(<OrderTable orders={[]} />);
    expect(screen.getByText(/no orders found/i)).toBeInTheDocument();
  });

  it('does not render a table when orders array is empty', () => {
    renderWithProviders(<OrderTable orders={[]} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  // ── Rendering rows ────────────────────────────────────────────────────────

  it('renders a row for each order', () => {
    renderWithProviders(<OrderTable orders={mockOrders} />);
    expect(screen.getByText('vintage_collector_uk')).toBeInTheDocument();
    expect(screen.getByText('photo_enthusiast_99')).toBeInTheDocument();
  });

  it('renders the formatted grand total for each order', () => {
    renderWithProviders(<OrderTable orders={[mockOrder]} />, 'GBP');
    // mockOrder grand_total is 53.99 GBP; with GBP preference the symbol is £
    expect(screen.getByText('£53.99')).toBeInTheDocument();
  });

  it('renders item count for each order', () => {
    renderWithProviders(<OrderTable orders={[mockOrder]} />);
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('renders "items" (plural) for multi-item orders', () => {
    const multiItemOrder = {
      ...mockOrder,
      line_items: [...mockOrder.line_items, ...mockOrder.line_items],
    };
    renderWithProviders(<OrderTable orders={[multiItemOrder]} />);
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  // ── Status badges ─────────────────────────────────────────────────────────

  it('renders PAID status badge', () => {
    renderWithProviders(<OrderTable orders={[{ ...mockOrder, status: 'PAID' }]} />);
    expect(screen.getByText('PAID')).toBeInTheDocument();
  });

  it('renders DELIVERED status badge', () => {
    renderWithProviders(<OrderTable orders={[{ ...mockOrder, status: 'DELIVERED' }]} />);
    expect(screen.getByText('DELIVERED')).toBeInTheDocument();
  });

  it('renders SHIPPED status badge', () => {
    renderWithProviders(<OrderTable orders={[{ ...mockOrder, status: 'SHIPPED' }]} />);
    expect(screen.getByText('SHIPPED')).toBeInTheDocument();
  });

  it('renders CANCELLED status badge', () => {
    renderWithProviders(<OrderTable orders={[mockCancelledOrder]} />);
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
  });

  // ── Links ─────────────────────────────────────────────────────────────────

  it('renders a View link for each order', () => {
    renderWithProviders(<OrderTable orders={mockOrders} />);
    const viewLinks = screen.getAllByRole('link', { name: /view/i });
    expect(viewLinks).toHaveLength(2);
  });

  it('View link points to the correct order detail URL', () => {
    renderWithProviders(<OrderTable orders={[mockOrder]} />);
    const link = screen.getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', `/orders/${mockOrder.id}`);
  });

  // ── Multiple orders ───────────────────────────────────────────────────────

  it('renders correct number of rows for multiple orders', () => {
    renderWithProviders(<OrderTable orders={mockOrders} />);
    const rows = screen.getAllByRole('row');
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3);
  });
});
