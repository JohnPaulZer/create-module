import { HealthPage } from "./pages/health/HealthPage";
import { UserCard } from "./components/user/UserCard";

export function App() {
  return (
    <>
      <HealthPage />
      <UserCard id="user-1" email="user@example.com" />
    </>
  );
}
