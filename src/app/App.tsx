import { createHashRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { CheerScreen } from '../screens/cheer/CheerScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { RecordScreen } from '../screens/record/RecordScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { StatsScreen } from '../screens/stats/StatsScreen';
import { Layout } from './Layout';

/** GitHub Pages는 서버 설정이 없어서 `#/history` 같은 해시 주소를 씁니다. */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <RecordScreen /> },
      { path: '/history', element: <HistoryScreen /> },
      { path: '/stats', element: <StatsScreen /> },
      { path: '/cheer', element: <CheerScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '*', element: <RecordScreen /> },
    ],
  },
];

const router = createHashRouter(routes);

export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
