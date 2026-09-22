import { render, screen } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import App from './App';

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: ({ element }) => element,
  Navigate: () => null,
}));

jest.mock('./components/Dashboard', () => () => <div>Dashboard</div>);
jest.mock('./components/Login', () => () => <h1>Login</h1>);
jest.mock('./components/Register', () => () => <div>Register</div>);

jest.mock('./firebase', () => ({
  auth: {},
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}));

test('redirects unauthenticated users to the login page', async () => {
  onAuthStateChanged.mockImplementation((auth, callback) => {
    callback(null);
    return jest.fn();
  });

  render(<App />);

  expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument();
});
