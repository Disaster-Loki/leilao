import { app } from "./app";
import { env } from "./config/env";
import { settleDueLots } from "./modules/settlement/settlement.service";

app.listen(env.PORT, () => console.log(`API on :${env.PORT}`));

// Liquidação periódica. A liquidação preguiçosa cobre o caso do servidor ter estado a dormir.
setInterval(() => {
  settleDueLots().catch((e) => console.error("settlement:", e));
}, 10_000);