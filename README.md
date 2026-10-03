# AI-native roblox-ts multi-place template

AIへ実装を依頼するための独立したゲーム開発テンプレートです。書籍のReVIEW制作環境は含みません。
LobbyとGameの2プレイスを、共有コードを再利用しつつ別々に生成します。完成ゲームや公開済みExperienceではありません。

## 起動手順

Node.js 22.13以上（Node.js 24 LTS推奨）、Rojo 7.5.1、Roblox Studioを用意してください。
Rokitを使う場合は `rokit install` でRojoの指定バージョンを用意できます。

```bash
git clone https://github.com/eiei114/roblox-ts-ai-native-template.git
cd roblox-ts-ai-native-template
npm ci
npm run check:full
npm run place
```

生成した `build/lobby.rbxlx` と `build/game.rbxlx` を別々にStudioで開き、Playで床・スポーン地点を確認します。
Outputに、Lobbyでは `lobby server ready` と `lobby client ready`、Gameでは `game server ready` と `game client ready` が出ることを確認してください。
このPlay確認とマルチプレイヤー確認は、CLIのビルド検証とは別です。

編集を同期する場合は `npm run watch` を起動し、別のターミナルで `npm run serve:lobby` または `npm run serve:game` を起動します。StudioのRojoプラグインで対応するサーバーへ接続します。
ポートはLobbyが34872、Gameが34873です。両方を同時に同期する場合は、Studioウィンドウと接続先の対応を確認してください。

## プレイスごとの起動処理を分ける

`compiler.project.json` は両プレイスのソースをコンパイルするためだけの構造です。**Studioへの同期やplace生成には使用しません。**
`places/lobby.project.json` はLobbyのエントリーポイントと共通モジュールだけを配置し、`places/game.project.json` はGameのものだけを配置します。別プレイス用の起動スクリプトを同時に動かさないための分離です。

Teleport・Place ID・Experience ID・DataStoreは設定していません。実際の同一Experienceに2プレイスを公開して行き来させる設定は、ユーザーがIDと公開方針を決めてから追加します。Studioだけの確認でTeleportの成功を主張しないでください。

## AIとの修正は高速チェックから始める

| コマンド                     | 用途                                             |
| ---------------------------- | ------------------------------------------------ |
| `npm run check`              | Oxfmt確認 → Oxlint → roblox-tsビルド             |
| `npm run format`             | 書式の修正。生成済みLuauは対象外                 |
| `npm run --silent lint:json` | AIへ渡せるJSON形式の診断                         |
| `npm run lint:roblox`        | OxlintのJSプラグインでRoblox専用ルールを追加検査 |
| `npm run lint:typed`         | 型情報が必要なRoblox専用ルールの検査             |
| `npm run check:full`         | 通常チェック・型依存lint・ツールの回帰テスト     |

通常のOxlintはネイティブルールだけで起動し、roblox-tsのビルドと組み合わせた高速経路にします。
追加の `lint:roblox` では `eslint-plugin-roblox-ts` の型情報を使わない16ルールを読み込みます。JSプラグインには起動コストがあるため、通常経路から分けています。
型依存ルールは別のESLintチェックに残し、`check:full` で両方を実行する構成です。
依存の宣言ファイルには通常のtscでの検査と両立しない箇所があるため、`skipLibCheck` を使用します。自分で書いたTypeScriptの型検査とroblox-tsの変換検査は残ります。`check:full` も外部宣言ファイル自体の健全性までは保証しません。詳しくは検証記録を参照してください。
OxfmtとOxlintはホスト側の開発ツールで、Robloxに配置するランタイムライブラリではありません。

## AIが編集する場所

- `src/server/common/`: 共通のサーバー専用モジュール
- `src/server/lobby/`・`src/server/game/`: 各プレイスのサーバー起動処理
- `src/client/common/`: 共通のクライアント専用モジュール
- `src/client/lobby/`・`src/client/game/`: 各プレイスのクライアント起動処理
- `src/shared/`: 両側から使うモジュール
- `places/*.project.json`: Rojoが各プレイスへ配置する構造
- `AGENTS.md`: AI向けの制約と検証手順

`out/` と `include/` は生成物なので編集しません。
npmのライブラリがすべてRobloxで動くわけではありません。実行時の依存はRoblox対応を確認し、このスターターでは `@rbxts/services` だけに絞っています。

## バージョンを固定する

roblox-ts 3.0.0が依存するTypeScript 5.5.3を合わせて固定しています。
単に最新のTypeScriptやtsgoへ置き換えると、コンパイラとの互換性を失う可能性があります。
依存は `package-lock.json` と `npm ci` で再現します。

まだAIのワンショット生成速度やトークン量を計測した結果はありません。lintやformatterの速さと、AIのコード生成速度は別の指標です。

検証条件と一次資料は [docs/tooling-verification.md](docs/tooling-verification.md)、ワンショット比較の手順は [docs/one-shot-protocol.md](docs/one-shot-protocol.md) を参照してください。

## ライセンス

MIT License（[LICENSE](LICENSE)）。テンプレートの名前は仮で、後で変更する可能性があります。
