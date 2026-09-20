# ふたりのほのぼの人狼

スマホ1台で交互に遊ぶオフラインモードと、スマホ2台で同じルームに入るオンラインモードを持つ、2人専用の人狼ゲームです。

## ファイル構成

- `index.html` アプリ本体
- `css/style.css` 画面デザイン
- `js/app.js` 画面遷移と全体制御
- `js/game.js` ラウンド進行、能力、勝敗処理
- `js/roles.js` 役職定義
- `js/scoring.js` 得点ルール
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
3. 左メニューの `SQL Editor` を開きます。
4. `supabase/schema.sql` の中身を貼り付けて実行します。
5. 続けて `supabase/policies.sql` の中身を貼り付けて実行します。
6. 左メニューの `Project Settings` → `API` を開きます。
7. `Project URL` と `anon public` key をコピーします。
8. `js/supabase.js` を開いて、次の2か所に貼り付けます。

```js
export const SUPABASE_CONFIG = {
  url: "https://xxxxxxxx.supabase.co",
  anonKey: "xxxxxxxx"
};
```

`service_role` key は絶対に貼り付けないでください。

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
4. 2人そろったらホストが役職を選んで開始します。
5. それぞれ自分の役職確認、能力、話し合い、最終選択、結果表示まで進めます。

## テスト項目

オフライン:

- 最初から結果まで1ゲームできる
- `次のゲーム` で連続ラウンドができる
- 役職確認時、相手に渡す前に画面が隠れる

オンライン:

- PCブラウザ2窓、またはスマホ2台でルーム作成と参加ができる
- 役職選択が5種類未満だと開始できない
- 役職確認、能力完了、話し合い、最終選択、結果、次ラウンドが同期する
- ページ更新後、同じブラウザなら可能な範囲でルームに復帰する
- 存在しないコード、満員の部屋、通信エラーで日本語メッセージが出る

## 役職や得点の調整

役職を増やす場合は `js/roles.js` の `ROLE_DEFINITIONS` に追加します。

得点を変える場合は `js/scoring.js` の `SCORE_RULES` の数値を変更します。ゲーム進行のコードを触らずに調整できます。

## セキュリティメモ

`player_secrets` はRLSで自分の一時プレイヤーIDの行だけ読めるようにしています。anon keyは公開される前提で問題ありません。

初期版ではGitHub Pagesだけで動くことを優先し、ラウンド同期のために `rooms.public_state` に進行状態を保存しています。より厳密に「DevToolsで相手の情報を一切見られない」運用にする場合は、配布・能力・結果計算をSupabase Edge FunctionまたはSecurity Definer RPCへ移し、`rooms.public_state` から未公開の役職や場札を完全に除外してください。
