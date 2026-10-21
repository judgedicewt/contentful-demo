// Japanese (ja-JP) overlay for the entries in ../sections.js, keyed by entry id.
import { doc, h2, p, ul } from '../richtext-helpers.js';

export default {
  'text-home-intro': {
    heading: 'ドライバーを中心に設計',
    body: doc(
      p('すべてのマクラーレンは、カーボンファイバー製のモノコックと一つの問いから始まります。ドライバーは何を必要としているのか。その答えは、より軽く、より速く、より直接的であることです。'),
    ),
  },
  'text-legacy-intro': {
    heading: '過去のモデル',
    body: doc(
      p('マクラーレンのロードカーは、一つの連続した系譜における一歩一歩です。標準を打ち立てたモデルから始め、年代を追ってご覧ください。'),
    ),
  },
  'text-legacy-2010s-intro': {
    heading: '2010年代',
    body: doc(
      p('カーボンファイバーが標準になりました。ハイブリッドパワーが登場しました。720S、765LT、P1がこの10年を象徴しました。'),
    ),
  },
  'text-legacy-1990s-intro': {
    heading: '1990年代',
    body: doc(
      p('一台の車、一つのアイデア。F1はドライバーを中央に据え、10年以上にわたって速度記録を保持しました。'),
    ),
  },
  'text-ownership-intro': {
    heading: 'オーナーシップ',
    body: doc(
      p('お客様のマクラーレンは、走るために作られています。サービス、サポート、そしてその先の道のりも、同じ思いを込めて設計されています。'),
    ),
  },
  'text-roadside-intro': {
    heading: 'ロードサイドアシスタンス',
    body: doc(
      p('万一の際も、お電話一本でサポートにお繋ぎします。補償は、マクラーレンが販売されているすべての市場でご利用いただけます。'),
    ),
  },
  'text-roadside-contacts': {
    heading: '地域別の連絡先番号',
    body: doc(
      h2('チームへのご連絡'),
      p('電話窓口は24時間体制です。登録番号と現在地をお伝えください。これらの番号はプレースホルダーです。'),
      ul('イギリス: +44 (0)00 0000 0001', 'ヨーロッパ: +00 00 0000 0002', '北米: +1 (000) 000-0003', '中東: +971 (0)0 000 0004'),
    ),
  },
  'text-experiences-intro': {
    heading: 'エクスペリエンス',
    body: doc(
      p('氷上で、サーキットで、そして車を作った人々とともに走ることができます。'),
    ),
  },
  'text-mso-intro': {
    heading: 'マクラーレン・スペシャル・オペレーションズ',
    body: doc(
      p('MSOは、あなただけが所有するマクラーレンを作ります。素材、仕上げ、細部をお選びください。残りはエンジニアが手がけます。'),
    ),
  },
  'imgblock-experiences': {
    caption: 'アークティック・エクスペリエンス、凍結した湖のサーキットにて。',
  },
  'banner-mso-generic': {
    eyebrow: 'カスタマイズ',
    heading: 'あなただけの一台',
    body: 'マクラーレン・スペシャル・オペレーションズは、仕様をシグネチャーへと変えます。カラー、カーボン、クラフトを、お客様のご要望に合わせて仕立てます。',
  },
  'banner-mcl-6gt': {
    eyebrow: 'レジェンドからのインスピレーション',
    heading: 'McL 6GTコンセプト',
    body: 'ル・マンの伝説のプロポーションを受け継ぐ、ロングテールのグランドツアラーです。一つのコンセプトを、公道のために描きました。',
  },
  'card-winter-ball': {
    title: 'ウィンターボール',
    body: '真冬に行われる、マクラーレンのデザインとエンジニアリングの夕べです。招待制となります。',
  },
  'card-arctic': {
    title: 'アークティック・エクスペリエンス',
    body: '凍った湖の上で、後輪駆動を体験いただけます。インストラクターが限界の位置をお伝えし、そのうえで限界をお客様ご自身で見つけていただきます。',
  },
  'card-track-day': {
    title: 'トラックデイ',
    body: 'マクラーレンのエンジニアとプロドライバーと共に、サーキットで丸一日を過ごします。お客様のお車でも、マクラーレンのお車でも。',
  },
  'grid-experiences': {
    heading: 'エクスペリエンスの選択',
  },
  'grid-legacy-all': {
    heading: 'レガシーモデル',
  },
  'grid-legacy-2010s': {
    heading: '2010年代のモデル',
  },
  'grid-legacy-1990s': {
    heading: '1990年代のモデル',
  },
  'stories-latest': {
    heading: '最新のストーリー',
  },
  'stories-mso': {
    heading: 'MSOのストーリー',
  },
  'cta-home': {
    heading: '旅の続き',
  },
  'cta-models': {
    heading: '旅の続き',
  },
  'cta-ownership': {
    heading: '旅の続き',
  },
  'cta-roadside': {
    heading: '旅の続き',
  },
  'cta-experiences': {
    heading: '旅の続き',
  },
  'cta-legacy': {
    heading: '旅の続き',
  },
  'cta-mso': {
    heading: '旅の続き',
  },
};
