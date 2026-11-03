import { Apple, Download, ExternalLink, Laptop, Smartphone, TabletSmartphone } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { DOWNLOADS, platformName } from '../core/platform';
import { Badge, Button, PageHeader } from '../ui/primitives';
import { PageScroll } from '../ui/Shell';

const WEB_URL = 'https://wakil-ia.vercel.app';

let deferredPrompt: any;
if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

function QR({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [text]);
  return <div className="size-36 bg-white rounded-xl p-1 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal pl-5 space-y-1 text-sm text-muted">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  );
}

export function InstallPage() {
  const [canPrompt, setCanPrompt] = useState(!!deferredPrompt);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  const plat = platformName();
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

  return (
    <PageScroll>
      <PageHeader title="Installer Wakil" subtitle="Une seule application, sur votre Mac, votre iPhone et votre Huawei — gratuitement." />
      {standalone && (
        <div className="card p-4 mb-4 text-sm">
          <Badge tone="ok">Installée</Badge> Wakil fonctionne déjà comme une application sur cet appareil ({plat}).
        </div>
      )}
      {canPrompt && (
        <Button
          variant="primary"
          className="mb-5"
          onClick={async () => {
            deferredPrompt?.prompt();
            await deferredPrompt?.userChoice;
            deferredPrompt = undefined;
            setCanPrompt(false);
          }}
        >
          <Download size={16} /> Installer sur cet appareil
        </Button>
      )}
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Laptop size={18} className="text-accent" />
            <h2 className="font-semibold">Mac</h2>
            <Badge tone="mint">Apple Silicon + Intel</Badge>
          </div>
          <p className="text-sm">Application Mac complète (avec terminal et dossier ~/Wakil pour l’agent) :</p>
          <div className="flex flex-col gap-2">
            <a href={DOWNLOADS.macArm}>
              <Button variant="primary" className="w-full">
                <Apple size={15} /> Mac M1/M2/M3/M4 (.dmg)
              </Button>
            </a>
            <a href={DOWNLOADS.macIntel}>
              <Button className="w-full">
                <Apple size={15} /> Mac Intel (.dmg)
              </Button>
            </a>
          </div>
          <Steps
            items={[
              'Ouvrez le .dmg et glissez Wakil dans « Applications ».',
              'Premier lancement : Réglages Système → Confidentialité et sécurité → « Ouvrir quand même » (application non signée, gratuite).',
              'Alternative sans téléchargement : ouvrez ce site dans Safari → menu Fichier → « Ajouter au Dock ».',
            ]}
          />
        </section>

        <section className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone size={18} className="text-accent" />
            <h2 className="font-semibold">iPhone / iPad</h2>
          </div>
          <p className="text-sm">Installation gratuite depuis Safari (aucun compte Apple payant nécessaire) :</p>
          <Steps items={['Ouvrez ' + WEB_URL + ' dans Safari.', 'Touchez le bouton Partager (carré avec flèche).', '« Sur l’écran d’accueil » → Ajouter.', 'Wakil s’ouvre en plein écran comme une app.']} />
          <QR text={WEB_URL} />
          <p className="text-xs text-muted">Scannez avec l’appareil photo de l’iPhone.</p>
        </section>

        <section className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TabletSmartphone size={18} className="text-accent" />
            <h2 className="font-semibold">Huawei / Android</h2>
          </div>
          <p className="text-sm">Fonctionne sans les services Google :</p>
          <a href={DOWNLOADS.apk}>
            <Button variant="primary" className="w-full">
              <Download size={15} /> Télécharger l’APK
            </Button>
          </a>
          <Steps
            items={[
              'Téléchargez l’APK puis ouvrez-le.',
              'Autorisez « Installer des applications inconnues » pour votre navigateur quand le téléphone le demande.',
              'HarmonyOS NEXT (sans APK) : ouvrez le site dans le navigateur → menu → « Ajouter à l’écran d’accueil ».',
            ]}
          />
          <QR text={DOWNLOADS.apk} />
        </section>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <a className="text-mint inline-flex items-center gap-1 hover:underline" href={DOWNLOADS.releases} target="_blank" rel="noreferrer">
          Toutes les versions <ExternalLink size={13} />
        </a>
        <a className="text-mint inline-flex items-center gap-1 hover:underline" href="#/guide">
          Guides détaillés (installation, stores, sécurité) →
        </a>
      </div>
    </PageScroll>
  );
}
