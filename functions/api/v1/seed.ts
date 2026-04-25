import { getDB, generateId } from './_lib/db';
import { verifyAuth, requireAuth } from './_lib/auth';

export const onRequest = async (context: any) => {
  const { request, env } = context;
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json' } });

  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // Always require ADMIN. The previous "skip auth if users table is empty"
    // bypass was a permanent open door on every fresh deploy and could be
    // re-armed by an attacker who first emptied the users table via any
    // other unauth path.
    requireAuth(await verifyAuth(request, env), 'ADMIN');

    const db = getDB(env);

    // Seed default settings
    await db.prepare("INSERT OR REPLACE INTO settings (key, data) VALUES ('general', ?)")
      .bind(JSON.stringify({
        maintenanceMode: false,
        businessName: 'Hughesys Que',
        businessAddress: 'Ipswich, QLD',
        logoUrl: '/logo.png',
        stripeConnected: false,
        squareConnected: false,
        smartPayConnected: false,
        smsConnected: false,
        facebookConnected: false,
        manualTickerImages: [],
        rewards: {
          enabled: false,
          programName: 'Que Rewards',
          staffPin: '1234',
          maxStamps: 10,
          rewardTitle: 'Free Pulled Pork Roll',
          rewardImage: '',
          possiblePrizes: [],
        },
        cateringPackages: [],
        cateringPackageImages: { essential: '', pitmaster: '', wholehog: '' },
      })).run();

    return json({ success: true, message: 'Database seeded with defaults' });
  } catch (err: any) {
    const status = err.status || 500;
    return json({ error: err.message || 'Internal Server Error' }, status);
  }
};
