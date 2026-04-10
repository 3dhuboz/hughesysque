
import React, { useState } from 'react';
import { seedDatabase, migrateFromFirestore } from '../../services/api';
import { Database, CheckCircle, AlertTriangle, Loader2, Flame, ArrowDownToLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DataSetup: React.FC = () => {
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [migrateResults, setMigrateResults] = useState<Record<string, any> | null>(null);
  const [firebaseKey, setFirebaseKey] = useState('');
  const navigate = useNavigate();

  const handleSeed = async () => {
    setIsLoading(true);
    setStatus('Initializing...');
    setError('');
    try {
      await seedDatabase();
      setStatus('Database seeded successfully!');
      setTimeout(() => navigate('/'), 2000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred during seeding.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigrate = async () => {
    setIsLoading(true);
    setStatus('Migrating data from Firestore...');
    setError('');
    setMigrateResults(null);
    try {
      const result = await migrateFromFirestore(firebaseKey || undefined);
      setMigrateResults((result as any).results || result);
      setStatus('Migration complete!');
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Migration failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bbq-dark flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-bbq-charcoal border border-gray-700 rounded-xl p-8 shadow-2xl space-y-8">
        <div className="text-center">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-bbq-red">
                <Database size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">System Setup</h1>
            <p className="text-gray-400 text-sm">Initialize or migrate your D1 Database.</p>
        </div>

        <div className="space-y-4">
            {error && (
                <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg flex gap-3 text-red-300 text-sm">
                    <AlertTriangle className="shrink-0" />
                    {error}
                </div>
            )}

            {status && (
                <div className="bg-green-900/20 border border-green-800 p-4 rounded-lg flex gap-3 text-green-300 text-sm items-center">
                    {isLoading ? <Loader2 className="animate-spin shrink-0"/> : <CheckCircle className="shrink-0" />}
                    {status}
                </div>
            )}

            {migrateResults && (
                <div className="bg-gray-900/50 border border-gray-700 p-4 rounded-lg space-y-1">
                    <h4 className="text-sm font-bold text-white mb-2">Migration Results</h4>
                    {Object.entries(migrateResults).map(([key, val]) => (
                        <div key={key} className="text-xs text-gray-300 flex justify-between">
                            <span className="capitalize">{key}</span>
                            <span className={String(val).startsWith('Error') ? 'text-red-400' : 'text-green-400'}>{String(val)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Migrate from Firestore */}
            <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg space-y-3">
                <div className="flex gap-3">
                    <ArrowDownToLine className="text-blue-400 shrink-0" size={18} />
                    <div>
                        <p className="text-sm text-blue-200 font-bold">Migrate from Firestore</p>
                        <p className="text-xs text-blue-300/70 mt-1">Pull all real data (menu items, orders, customers, images, settings) from the old Firebase project into D1.</p>
                    </div>
                </div>
                <input
                    type="text"
                    value={firebaseKey}
                    onChange={e => setFirebaseKey(e.target.value)}
                    placeholder="Firebase API Key (AIza...) — optional"
                    className="w-full bg-black/40 border border-gray-700 rounded p-2 text-white font-mono text-xs"
                />
                <button
                    onClick={handleMigrate}
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-3 transition shadow-lg disabled:opacity-50"
                >
                    <ArrowDownToLine size={18} /> Migrate from Firestore
                </button>
            </div>

            {/* Seed defaults */}
            <div className="bg-gray-900/30 border border-gray-700 p-4 rounded-lg space-y-3">
                <div className="flex gap-3">
                    <AlertTriangle className="text-gray-400 shrink-0" size={18} />
                    <p className="text-xs text-gray-400">
                        <strong>Or seed defaults:</strong> Initialize with sample data instead. Existing data will be preserved.
                    </p>
                </div>
                <button
                    onClick={handleSeed}
                    disabled={isLoading}
                    className="w-full bg-bbq-red hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-3 transition shadow-lg disabled:opacity-50"
                >
                    <Flame size={18} /> Seed Default Data
                </button>
            </div>
        </div>

        <div className="text-center">
            <button onClick={() => navigate('/')} className="text-gray-500 text-sm hover:text-white">Skip to Home</button>
        </div>
      </div>
    </div>
  );
};

export default DataSetup;
