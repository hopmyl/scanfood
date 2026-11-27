import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import CatalogScreen from './screens/CatalogScreen';
import DishScreen from './screens/DishScreen';
import ScanScreen from './screens/ScanScreen';
import PantryScreen from './screens/PantryScreen';
import ShoppingScreen from './screens/ShoppingScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import DiaryScreen from './screens/DiaryScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProScreen from './screens/ProScreen';
import { useAppStore } from './store/useAppStore';

/** При переходе на новый экран скроллим окно наверх */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const theme = useAppStore((s) => s.theme);

  // Тема применяется к <html data-theme="…"> — CSS-переменные переключаются на лету
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="min-h-screen bg-app text-ink">
      <ScrollToTop />
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-36 md:max-w-2xl md:px-6 lg:max-w-6xl lg:px-8">
        <Routes>
          <Route path="/" element={<CatalogScreen />} />
          <Route path="/dish/:id" element={<DishScreen />} />
          <Route path="/scan" element={<ScanScreen />} />
          <Route path="/pantry" element={<PantryScreen />} />
          <Route path="/shopping" element={<ShoppingScreen />} />
          <Route path="/favorites" element={<FavoritesScreen />} />
          <Route path="/diary" element={<DiaryScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/pro" element={<ProScreen />} />
          <Route path="*" element={<CatalogScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
