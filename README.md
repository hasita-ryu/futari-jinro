# TRUST DUEL

2人で情報を読み合う、短時間の心理カードゲームです。

スマホ1台で交互に遊ぶオフラインモードと、スマホ2台で同じルームに入るオンラインモードに対応しています。自分だけが見られるカード情報、カード効果、相談フェーズ、最終判断、判定表示までをWebアプリとして実装しています。

## 技術構成

- `index.html` アプリ本体
- `css/style.css` 画面デザイン
- `js/app.js` 画面遷移と全体制御
- `js/game.js` ラウンド進行、カード効果、判定処理
- `js/roles.js` カード定義
- `js/scoring.js` スコアルール
- `js/online.js` Supabase同期
- `js/supabase.js` Supabase接続設定
- `supabase/schema.sql` テーブル作成SQL
- `supabase/policies.sql` RLSポリシーSQL
- `manifest.json` / `service-worker.js` PWA設定

## ローカルで確認する

このフォルダで簡易サーバーを起動します。

```bash
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000` を開きます。

## Supabase初期設定

1. [Supabase](https://supabase.com/) にログインします。
2. `New project` から無料プロジェクトを作ります。
3. 左メニューの `Authentication` → `Providers` を開き、`Anonymous sign-ins` を有効にします。
4. 左メニューの `SQL Editor` を開きます。
5. `supabase/schema.sql` の中身を貼り付けて実行します。
6. 続けて `supabase/policies.sql` の中身を貼り付けて実行します。
7. 左メニューの `Project Settings` → `API` を開きます。
8. `Project URL` と `Publishable key` をコピーします。
9. `js/supabase.js` の次の2か所に貼り付けます。

```js
export const SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "xxxxxxxx"
};
```

`service_role` key や `secret` key は絶対に貼り付けないでください。

## GitHub Pages公開手順

1. GitHubで新しいリポジトリを作ります。
2. このフォルダのファイルをすべてpushします。
3. GitHubのリポジトリ画面で `Settings` → `Pages` を開きます。
4. `Build and deployment` の `Source` を `Deploy from a branch` にします。
5. `Branch` を `main`、フォルダを `/root` にして保存します。
6. 数十秒後に表示されるURLをスマホ2台で開きます。

## オンラインで遊ぶ

1. 片方のスマホで `オンラインで遊ぶ` → `部屋を作る` を押します。
2. 6桁のルームコードを相手に伝えます。
3. もう片方のスマホで `部屋に入る` からコードを入力します。
4. 2人そろったらホストがカードを選んで開始します。
5. それぞれ自分のカード確認、効果処理、相談、最終判断、判定表示まで進めます。

## テスト項目

オフライン:

- 最初から判定まで1ゲームできる
- `次のゲーム` で連続ラウンドができる
- カード確認時、相手に渡す前に画面が隠れる

オンライン:

- PCブラウザ2窓、またはスマホ2台でルーム作成と参加ができる
- カード選択が5種類未満だと開始できない
- カード確認、効果処理完了、相談、最終判断、判定、次ラウンドが同期する
- ページ更新後、同じブラウザなら可能な範囲でルームに復帰する
- 存在しないコード、満員の部屋、通信エラーで日本語メッセージが出る

## カードやスコアの調整

カードを増やす場合は `js/roles.js` の `ROLE_DEFINITIONS` に追加します。

スコアを変える場合は `js/scoring.js` の `SCORE_RULES` の数値を変更します。ゲーム進行のコードを触らずに調整できます。

## 公開用メモ

このアプリは個人制作のオリジナルWebゲームです。公開時は、カード画像・タイトル・説明文・UIテイストが自作のものになっていることを確認してください。

オンライン参加者はSupabaseの匿名ログインで発行される `auth.uid()` で識別します。`player_secrets` はRLSで自分の参加者IDの行だけ読めるようにしています。Publishable keyは公開される前提で問題ありません。

より厳密に「DevToolsで相手の情報を一切見られない」運用にする場合は、配布・効果処理・判定計算をSupabase Edge FunctionまたはSecurity Definer RPCへ移し、`rooms.public_state` から未公開カードや伏せ札を完全に除外してください。
