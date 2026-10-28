import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import CatalogScreen from './screens/CatalogScreen';
import DishScreen from './screens/DishScreen';
import ScanScreen from './screens/ScanScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import ProfileScreen from './screens/ProfileScreen';

/** При переходе на новый экран скроллим окно наверх */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="min-h-screen bg-cream">
      <ScrollToTop />
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-28">
        <Routes>
          <Route path="/" element={<CatalogScreen />} />
          <Route path="/dish/:id" element={<DishScreen />} />
          <Route path="/scan" element={<ScanScreen />} />
          <Route path="/favorites" element={<FavoritesScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="*" element={<CatalogScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
