import { useAuth } from "../../hooks/auth/useAuth";

export function Auth() {
  const { items } = useAuth();

  return (
    <section>
      <h1>Auth</h1>
      <p>{items.length} items</p>
    </section>
  );
}
