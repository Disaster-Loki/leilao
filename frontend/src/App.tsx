import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Guard from "./components/Guard";
import Login from "./pages/Login";
import Showcase from "./pages/Showcase";
import LotRoom from "./pages/LotRoom";
import Wallet from "./pages/Wallet";
import AuctioneerPanel from "./pages/AuctioneerPanel";
import MyBids from "./pages/MyBids";
import ReceiptPage from "./pages/ReceiptPage";
import AuditPage from "./pages/AuditPage";
import AccountPage from "./pages/AccountPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Públicas */}
        <Route path="/" element={<Showcase />} />
        <Route path="/login" element={<Login />} />
        <Route path="/account" element={<Guard><AccountPage /></Guard>} />
        <Route path="/lots/:id" element={<LotRoom />} />
        <Route path="/receipts/:id" element={<ReceiptPage />} />
        <Route path="/audit/:lotId" element={<AuditPage />} />

        {/* Leiloeiro */}
        <Route
          path="/panel"
          element={
            <Guard role="auctioneer">
              <AuctioneerPanel />
            </Guard>
          }
        />

        {/* Licitante */}
        <Route
          path="/wallet"
          element={
            <Guard>
              <Wallet />
            </Guard>
          }
        />
        <Route
          path="/my/bids"
          element={
            <Guard role="bidder">
              <MyBids />
            </Guard>
          }
        />

        <Route
          path="*"
          element={
            <div className="empty-state" style={{ marginTop: "4rem" }}>
              <p className="empty-icon">404</p>
              <p>Página não encontrada.</p>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
