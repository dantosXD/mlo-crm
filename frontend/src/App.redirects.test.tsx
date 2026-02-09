import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { TabRedirect } from './App';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-value">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe('legacy route compatibility redirects', () => {
  it('redirects /communication-templates to communications templates tab', async () => {
    render(
      <MemoryRouter initialEntries={['/communication-templates?foo=bar']}>
        <Routes>
          <Route
            path="/communication-templates"
            element={<TabRedirect to="/communications" tab="templates" />}
          />
          <Route path="/communications" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    const output = await screen.findByTestId('location-value');
    expect(output.textContent).toContain('/communications');
    expect(output.textContent).toContain('tab=templates');
    expect(output.textContent).toContain('foo=bar');
  });

  it('redirects /workflows/executions to workflows executions tab', async () => {
    render(
      <MemoryRouter initialEntries={['/workflows/executions']}>
        <Routes>
          <Route
            path="/workflows/executions"
            element={<TabRedirect to="/workflows" tab="executions" />}
          />
          <Route path="/workflows" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    const output = await screen.findByTestId('location-value');
    expect(output.textContent).toContain('/workflows');
    expect(output.textContent).toContain('tab=executions');
  });
});
