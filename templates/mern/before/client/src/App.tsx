import { HealthPage } from "./pages/HealthPage";
import { UserCard } from "./components/UserCard";

export function App() {
  return (
    <>
      <HealthPage />
      <UserCard id="user-1" email="user@example.com" />
    </>
  );
}
