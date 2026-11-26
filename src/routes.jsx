/* Rutas
   /            → login de barberos (sin landing)
   /app/*       → app de barberos, dueño y super admin
   /clientes/*  → lo que ven los clientes (link que se comparte) */
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "./components/ui";
import { Login } from "./pages/Login";
const L = (load, name) => () => load().then((m) => ({ Component: m[name] }));
const page = (name) => L(() => import(`./pages/app/${name}.jsx`), name);

import { ClientLayout } from "./pages/client/ClientLayout";
import { ClientHome } from "./pages/client/ClientHome";
import { Booking } from "./pages/client/Booking";
import { MyAppts } from "./pages/client/MyAppts";
import { Loyalty } from "./pages/client/Loyalty";

function Root() {
  return (
    <>
      <div className="aura"><i /><i /><i /></div>
      <Outlet />
      <Toaster />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: "/", element: <Login /> },
      {
        path: "/app", lazy: L(() => import("./pages/app/AppShell.jsx"), "AppShell"),
        children: [
          { index: true, lazy: page("Home") },
          { path: "agenda", lazy: page("Agenda") },
          { path: "nueva", lazy: page("NewAppt") },
          { path: "analisis", lazy: page("Analytics") },
          { path: "mas", lazy: page("More") },
          { path: "perfil", lazy: page("Profile") },
          { path: "horario", lazy: page("MySchedule") },
          { path: "bloqueos", lazy: page("Blocks") },
          { path: "club", lazy: page("Club") },
          { path: "servicios", lazy: page("Services") },
          { path: "equipo", lazy: page("Team") },
          { path: "control", lazy: page("Control") },
        ],
      },
      {
        path: "/clientes", element: <ClientLayout />,
        children: [
          { index: true, element: <ClientHome /> },
          { path: "reservar", element: <Booking /> },
          { path: "mis-citas", element: <MyAppts /> },
          { path: "club", element: <Loyalty /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
