# Oxcとroblox-tsの組み合わせをローカルで検証した

検証日: 2026-09-30

通常の修正ループはネイティブOxlint・Oxfmt・roblox-tsビルドに絞り、Roblox専用の追加lintは引き渡し前のチェックへ分けた。LobbyとGameは同じTypeScriptプロジェクトからコンパイルし、別のRojo構造で生成する。

## 依存は実際に使ったバージョンで固定する

| 用途             | ツール                            | バージョン       |
| ---------------- | --------------------------------- | ---------------- |
| Luauへの変換     | roblox-ts                         | 3.0.0            |
| 型検査           | TypeScript                        | 5.5.3            |
| ネイティブlint   | Oxlint                            | 1.86.0           |
| 書式整形         | Oxfmt                             | 0.71.0           |
| Roblox専用ルール | eslint-plugin-roblox-ts           | 1.4.1            |
| 型依存lintの実行 | ESLint / typescript-eslint parser | 10.11.0 / 8.71.0 |
| place生成・同期  | Rojo                              | 7.5.1            |

roblox-ts 3.0.0のnpmメタデータはTypeScriptを `=5.5.3` に固定している。最新のTypeScriptやtsgoをコンパイラの代わりに導入することはしなかった。ホスト側の開発ツールと、Roblox上で動く `@rbxts/services` は分けて管理する。

## 高速経路と追加検査を分離する

OxlintのJSプラグイン経路では型情報を必要とするルールを実行できない。そのため、通常の `lint` はネイティブルールのみ、`lint:roblox` は型情報を使わない16個のRobloxルール、`lint:typed` は型情報が必要なルールに分けた。プラグインを読み込んだだけで成功と判断せず、意図的な違反を検出するテストを用意した。

`skipLibCheck` は依存の宣言ファイル内の検査だけを省く。固定したRoblox型定義には、通常の `tsc` で宣言自体を検査すると `CollectionHandle` の未定義やselector型の添字エラーが出る箇所がある。このため `typecheck` でも除外し、依存宣言を完全に検証できたとは扱わない。利用者のTypeScriptとroblox-tsの変換は検査する。利用者の型エラーを検出できることは回帰テストで確認する。

roblox-ts 3.0.0の実装は利用者のソースごとに診断を取得する。したがって、`skipLibCheck` の変更でroblox-tsの宣言検査時間を削減した、という説明はしない。

AI向けの補助は、`AGENTS.md`、JSON診断、明確なソース配置、共通チェックコマンドを中心にした。未使用コード解析やAST編集などのライブラリは、必要になるまで追加しない。AIが利用できる情報と検証手順を先に揃える。

## このPCでの実測値

Windows x64、Node.js 26.7.0、npm 11.19.1で、各コマンドを1回ウォームアップしてから3回計測した。7個のTypeScriptソースを持つこの最小構成が対象で、AIのコード生成速度は測っていない。

| コマンド・構成                    |  中央値 |     3回の範囲 |
| --------------------------------- | ------: | ------------: |
| `lint`（ネイティブOxlint）        |  1.81秒 |  1.50〜2.58秒 |
| `lint:roblox`（JSプラグイン追加） |  4.25秒 |  4.14〜4.59秒 |
| `check`（通常の高速経路）         | 10.97秒 | 7.95〜11.39秒 |

これは同じPC上の参考値で、条件を交互に実行した厳密な比較実験ではない。別の実行では `check` の中央値が19.18秒だった。ホストの負荷やキャッシュも影響するため、設定変更による短縮率は断定しない。AIの生成トークンが減る、ゲームの実行が速くなる、といった結論にも使わない。

`npm run benchmark:tooling` で再計測し、結果は生成物の `build/tooling-benchmark.json` に保存する。通常は `watch` を立ち上げたまま編集し、必要なチェックだけを選んで実行する。

## 再現するコマンド

```bash
npm ci
npm run check:full
npm run place
npm run benchmark:tooling
```

ツールの回帰テストは、バージョン整合、ルール網羅、明示的なany、null、for-in、書式違反、型依存の配列チェック、ユーザーソースの型エラー、プレイスの配置分離を検査する。
place生成後はRojoのsourcemapからScript・LocalScript・共通ModuleScriptの配置と、別プレイスの起動処理が混ざらないことを確認する。

このチェックアウトで `npm run check:full && npm run place` は終了コード0だった。回帰テスト8件が成功し、LobbyとGameの両方を生成・配置検証した。前提は `npm ci` 済みの依存と、PATH上のRojo 7.5.1。検証ホストは上記のNode.js 26.7.0で、推奨のNode.js 24 LTS上ではまだ実行していない。

StudioのPlay、実プレイヤーによるマルチプレイ、公開済みExperience内のTeleportは未検証。Place IDも未設定で、CI・ゲーム公開・有料AI比較は実行していない。

## 一次資料と調査方法

公式ドキュメント、公式テンプレート、npmの公開メタデータを確認し、固定バージョンをインストールしてCLIで検証した。GitHubの最新READMEだけでは公開済みパッケージの互換性を保証できないため、実際の違反検出を確認した。Gemini CLIは認証側の利用制限で起動できず、調査は一次資料の直接確認で補った。

- [roblox-ts Setup Guide](https://roblox-ts.com/docs/setup-guide/)
- [公式create-roblox-tsのgame設定](https://github.com/roblox-ts/create-roblox-ts/tree/master/templates/game)
- [roblox-ts 3.0.0のnpmメタデータ](https://registry.npmjs.org/roblox-ts/3.0.0)
- [Oxlint JS Pluginsと制限](https://oxc.rs/docs/guide/usage/linter/js-plugins)
- [Oxfmt設定](https://oxc.rs/docs/guide/usage/formatter/config)
- [eslint-plugin-roblox-tsのルールとOxlint対応](https://github.com/roblox-ts/eslint-plugin-roblox-ts)
- [eslint-plugin-roblox-ts 1.4.1のnpmメタデータ](https://registry.npmjs.org/eslint-plugin-roblox-ts/1.4.1)
- [Rojo project format](https://rojo.space/docs/v7/project-format/)
