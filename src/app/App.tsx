import { createHashRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { CheerScreen } from '../screens/cheer/CheerScreen';
import { SongScreen } from '../screens/cheer/SongScreen';
import { ThemeScreen } from '../screens/settings/ThemeScreen';
import { RecapScreen } from '../screens/stats/RecapScreen';
import { TutorialScreen } from '../screens/tutorial/TutorialScreen';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { RecordScreen } from '../screens/record/RecordScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { StatsScreen } from '../screens/stats/StatsScreen';
import { AmountScreen } from '../screens/record/AmountScreen';
import { ListStepScreen } from '../screens/record/ListStepScreen';
import { RecordDetailScreen } from '../screens/history/RecordDetailScreen';
import { PresetsScreen } from '../screens/settings/PresetsScreen';
import { RecurringScreen } from '../screens/settings/RecurringScreen';
import { CheckScreen } from '../screens/check/CheckScreen';
import { VisitedScreen } from '../screens/stats/VisitedScreen';
import { Layout } from './Layout';

/** GitHub Pages는 서버 설정이 없어서 `#/history` 같은 해시 주소를 씁니다. */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <RecordScreen /> },
      { path: '/record/:targetId', element: <ListStepScreen step="category" /> },
      { path: '/record/:targetId/:categoryId', element: <ListStepScreen key="detail" step="detail" /> },
      { path: '/record/:targetId/:categoryId/:detailId', element: <AmountScreen />, handle: { hideTabs: true } },
      { path: '/check', element: <CheckScreen /> },
      { path: '/history', element: <HistoryScreen /> },
      { path: '/records/:id', element: <RecordDetailScreen /> },
      { path: '/stats', element: <StatsScreen /> },
      { path: '/stats/places', element: <VisitedScreen /> },
      { path: '/stats/recap/:year', element: <RecapScreen />, handle: { hideTabs: true } },
      { path: '/tutorial', element: <TutorialScreen />, handle: { hideTabs: true } },
      { path: '/cheer', element: <CheerScreen /> },
      { path: '/cheer/:id', element: <SongScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/settings/presets', element: <PresetsScreen /> },
      { path: '/settings/recurring', element: <RecurringScreen /> },
      { path: '/settings/theme', element: <ThemeScreen /> },
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
