# AIに渡す情報を絞り、Robloxでの検証を短くする

調査日: 2026-09-30。対象はこのマルチプレイステンプレートの初期コミット `d9be6dad35cc1532df402414f3110a708c63e90e`。

## 最初に増やすのはパッケージ数より、入力の絞り込みと検証経路

推奨する順序は、必要なソースだけを渡す仕組み、サーバー・クライアント間の依存境界チェック、Studioでの動作確認。その後、通信処理を作る段階で型付きRemoteと実行時の入力検査を加える。

Repomixのローカル試用では、全7ソースの入力が312推定トークン、Lobbyのサーバーに関係する3ソースが161推定トークンだった。ただし後者は情報を限定した入力で、全体と同じ情報量ではない。AIモデルへのリクエストは送っていない。生成速度、修正回数、総使用トークンの削減効果は未計測。

現在は小さいテンプレートなので、候補を全部入れる必要はない。調査ではプロジェクトの依存やゲームコードを変更せず、試用ツールと出力をリポジトリ外の一時ディレクトリに置いた。

## 候補は開発用とRoblox実行用に分ける

バージョンは調査時のnpm `latest`。導入を決めたバージョンではない。

| 候補                                       | 用途                                        | このテンプレートでの提案                            | 確認範囲                                      |
| ------------------------------------------ | ------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Repomix 1.18.1                             | AIへ渡すファイル選択・トークン見積もり      | オンデマンドで使う。修正対象の全文を優先            | 実際のソースで3構成を試用                     |
| dependency-cruiser 18.4.0                  | import境界・循環依存の検査                  | 次の追加候補。軽量な独自検査との比較も行う          | 現状と意図的な違反を検査                      |
| Knip 6.38.0                                | 不要ファイル・export・依存の候補検出        | 規模が増えてから、手動レビュー付きで使う            | entryを指定して試用。型パッケージの誤検知あり |
| TypeScript Compiler API / ts-morph 28.0.0  | シンボル一覧・型付き検索・コード変換        | まず既存TypeScriptのAPIを使う。ts-morphは大量編集時 | 一次資料を確認。新しい変換処理は未実装        |
| Roblox公式Studio MCP                       | Studioの探索・Play・ログ取得                | AIによる検証の優先候補                              | 公式仕様を確認。接続・実機操作は未実施        |
| `@rbxts/t` 3.2.1                           | 実行時の入力型検査                          | Remoteを作るときに候補にする                        | 公開パッケージ・作者資料を確認                |
| `@rbxts/net` 3.0.10                        | 型付きRemote定義とmiddleware                | 少数の通信から試す。通信仕様を1か所にまとめる       | 作者資料を確認。現構成でのビルドは未試行      |
| `@rbxts/specium` 1.2.2                     | Roblox上の軽量テスト                        | 小さいランタイムテストの第一試用候補                | 作者資料・依存メタデータを確認。実行は未実施  |
| `@rbxts/jest` / `jest-globals` 3.16.0-ts.1 | Jest LuaをTypeScriptから使う                | Jest系のテストが必要になった段階で比較              | 作者資料を確認。Rojo追加設定が必要            |
| Flamework core/networking 1.3.2            | DI・コンポーネント・型から生成する通信guard | 今回の最小構成には保留。大きいゲーム向けに別評価    | 作者資料を確認。変換器・設定変更が必要        |

## Repomixは圧縮より、対象ファイルの選択を先に使う

[RepomixのCLI](https://repomix.com/guide/command-line-options)には `--include`、`--stdin`、`--token-count-tree`、`--token-budget` がある。必要なファイルだけをまとめ、入力上限を検査できる。ソースの取り込みはローカルで行い、今回の試用ではクラウド送信をしていない。

Node.js 26.7.0、Windows x64、Repomix 1.18.1、`o200k_base`で測定した。XMLのファイル包装は含むが、AGENTS.md、設定、依頼文、応答、推論トークンは含まない。

| 入力                                      | ファイル数 | 推定トークン |
| ----------------------------------------- | ---------: | -----------: |
| `src/**/*.ts` の全文                      |          7 |          312 |
| server/common・server/lobby・sharedの全文 |          3 |          161 |
| 全ソースの `--compress` 出力              |          7 |          236 |

[圧縮機能](https://repomix.com/guide/code-compress)は実験的で、関数の実装や内部処理を省く。今回の圧縮出力は `GAME_NAME` の定数とエントリーポイントの呼び出しまで省いていた。全体構造の説明には使えるが、その出力だけで実装修正やセキュリティレビューをさせるのは避ける。

**提案:** AIには短い配置図と関連する型・関数の一覧を渡し、編集する関数とその直接依存は全文で渡す。`node_modules`、`out`、`include`、place生成物、lockfileの全文は通常のコード修正用入力から外す。依存更新やコンパイラ調査では必要な範囲を別途読む。AGENTS.mdと依頼に関係する設定は省かない。

Repomixの[機密検査](https://repomix.com/guide/security)は有効のまま使う。ただし検査成功は機密情報がない保証ではない。privateコードを外部AIへ渡すときの承認は別に必要。ここでの推定値をClaudeやGeminiの実使用量として扱わない。

## 依存境界チェックで、AIの誤ったimportを早く止める

[dependency-cruiser](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md)は、ファイル間のimportに禁止ルールを設定できる。この構成では次を対象にする。

- sharedからserver/clientへの依存
- clientからserver、serverからclientへの依存
- LobbyからGame、GameからLobbyの起動処理への依存
- 循環依存

試用では7個のTypeScriptソースと外部サービスモジュール1個を解析し、違反は0件。別の小さいfixtureでsharedからserverへimportすると、狙ったルールが1件検出した。これはトークン削減の実測ではない。誤った実装を早く返すための検証経路として評価する。

試用で2つ注意点が見つかった。隔離したnpx環境からTypeScriptを解決できず、0ファイル解析のまま終了コード0になる場合があった。TypeScript 5.5.3を試用ツールと同じ環境へ置いて解析対象を確認した。また、今回の `--output-type json` は違反があっても終了コード0だった。終了コードで止めるなら `err` 出力を使うか、JSONの `summary.error` と解析したソース数を明示的に検査する。

これはソースの依存検査で、Rojoの配置確認や実行時の権限検査を置き換えない。特にサーバー専用コードをReplicatedStorageへ配置しないことは、既存のplace検証と一緒に守る。

## Knipは不要コードの候補を返す。自動削除はしない

[Knipのentry/project設定](https://knip.dev/guides/configuring-project-files)を使い、`*.server.ts` と `*.client.ts`、ホスト側のscripts/testsを起点に指定した。共有ファイルはimportから到達させ、全ソースをentryにする方法は避けた。

この設定で不要ソースやexportは報告されなかったが、`@rbxts/types` と `@rbxts/compiler-types` が未使用依存として報告された。両方ともこのプロジェクトには必要なので、結果をそのまま削除指示に使えない。型ルートやroblox-ts専用依存の例外を、理由付きで設定する必要がある。[TypeScriptプラグイン](https://knip.dev/reference/plugins/typescript)の存在だけではRobloxの起動・配置構造は説明できない。

## シンボル一覧は既存のTypeScriptから生成できる

[TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)でimport、export、関数、型の一覧を作れる。既にTypeScript 5.5.3があるため、簡単な一覧のためだけに新しい依存を追加する必要はない。

[ts-morph](https://ts-morph.com/)は型付き解析やAST編集を扱いやすくするラッパーで、大量の安全なコード変換には候補になる。ただしAIへ渡すだけの要約とは別の用途。[ts-morph自身のcompiler API](https://ts-morph.com/navigation/compiler-nodes)とroblox-ts用のTypeScriptを混同したり、コンパイラを置き換えたりしない。構造一覧から省いた実装には、後でファイルを開ける経路を残す。

## Roblox公式Studio MCPで、ビルド後の確認をAIへ返す

[公式Studio MCP](https://create.roblox.com/docs/studio/mcp)はStudio組み込みのローカルstdioサーバー。公式資料にはツリー探索、特定行のスクリプト読み取り、Luau実行、Play開始・終了、ログ取得、画面取得が記載されている。複数Studioの一覧と `studio_id` による操作先の指定もある。

**提案:** LobbyとGameを別々に起動し、対象Studio IDを明示して、起動ログと短い期待結果をAIに返す。データモデル全体や全ログを毎回取得せず、関係するパス・行・エラーを優先する。取得範囲の設定は、実際に接続したツールのスキーマを確認する。

Studioにはコード編集・実行・アセット操作の権限もある。このテンプレートではTypeScriptが正本なので、生成済みLuauをStudioで修正して完了にしない。まず検証・読み取り用途で設定し、ソース修正はTSへ戻す。接続だけでtoken削減や安全性が保証されるわけではない。今回MCP設定の追加、Studio操作、公開はしていない。

## 型付きRemoteと実行時検査を組み合わせる

[`@rbxts/net`](https://github.com/roblox-aurora/rbx-net)は通信定義を一か所へ集め、Server/Client別のAPIや型検査・レート制限のmiddlewareを提供する。AIが通信名、方向、引数を別々に作る問題を減らすための候補。ただし現在は通信処理がないため、導入前に最小の1イベントをビルド・実行確認する。

[`@rbxts/t`](https://github.com/osyrisrblx/t)は配列・テーブル・Instanceなどの実行時検査に使える。TypeScriptの型だけでは悪意あるクライアントの入力を拒否できない。[Roblox公式の境界安全ガイド](https://create.roblox.com/docs/scripting/security/client-server-boundary)に従い、型に加えて値の範囲、所有者、権限、距離、頻度をサーバーで確認する。

型定義を読みやすくするなら、通信用の型とゲームの不変条件を近くに置き、サーバー側の処理を短い関数に分ける。秘密やサーバー専用の実装を共有フォルダへ置く理由にはしない。npmのZodやValibotを、そのままRobloxランタイムへ追加することも避ける。

## テストは軽量な候補から始め、Flameworkは別枠で評価する

[`@rbxts/specium`](https://github.com/thecogumeta/rbx-specium)は構造化されたテスト結果とassertionを提供し、作者READMEでは外部依存なしとしている。小さいゲームロジックをRoblox上で確認する用途から試せる。ただし今回のコンパイラ・Studioでは未実行。

[`@rbxts/jest`](https://github.com/littensy/rbxts-jest)はJest LuaのTypeScript型を提供する。Jest形式を使いたい場合の候補だが、作者のセットアップでは `@rbxts-js` もRojoへ配置する必要がある。現状の3つのRojo projectはそのscopeを配置しないため、npm追加だけでは済まない。テスト用コード・依存を通常の両placeへ配布しない構成も必要。

TestEZは引き続き利用可能な選択肢だが、[公式Roblox/TestEZ repo](https://github.com/Roblox/testez)は調査時にarchivedだった。`@rbxts/testez` forkを確認せず、最新の標準として自動採用はしない。現在のNodeテスト8件は開発ツールの検査で、Roblox上のゲーム動作テストではない。

[Flamework networking](https://flamework.fireboltofdeath.dev/docs/additional-modules/networking/introduction/)には型から生成する通信guardがある。ただし[導入手順](https://flamework.fireboltofdeath.dev/docs/installation/)にはtransformer、decorator、typeRoots、Rojoのscope設定が含まれる。通信のためだけに今の最小構成全体を置き換える提案はしない。設定・ビルド・AIが読む概念を含めた別の比較が必要。

## 次の実装候補と未検証事項

1. 対象プレイスとServer/Clientを指定する、全文ベースのコンテキスト出力。必要な指示・設定・型を含め、推定トークンと対象ファイルを表示する。
2. 境界検査。意図的な違反を検出するテストと、0ファイル解析を拒否するチェックを付ける。
3. Studio MCPによるPlay確認。対象Studio IDを固定し、成功条件とエラーログを小さく返す。
4. 最初のRemoteを作る際にnet/tを試し、サーバーの権限検査も含める。
5. 小さいRobloxランタイムテストを追加し、Node側のテストと分ける。

上記は提案で、採用済みの依存ではない。AI比較、Studio、通信ライブラリ、ランタイムテストの実行は未実施。モデルごとの総トークン削減や正答率は、同一条件でprovider usageと検証結果を記録してから判断する。実行時間が速いツールと、AIへの入力が短い仕組みも別に評価する。

## 方法と再現資料

公式ドキュメント、作者README、npm registryの公開メタデータ、GitHub repoのarchived状態を確認した。Gemini CLIは前の調査で認証側の利用制限が確認済みのため、今回も一次資料の直接確認を使った。

試用ログと出力は `C:/Users/Keisu/Projects/tmp/roblox-ts-ai-tools-research/` に保存した。主な資料は `package-metadata.json`、`repomix.log`、3つのXML、`knip-report.json`、`boundary-report.json`、`boundary-negative-report.json`、`boundary-negative.err.txt`。再検証用のdependency-cruiserとTypeScriptは `host-tools/` に保持している。

Repomix全文の再現コマンドは、repoルートで次を実行する。出力先はrepo外に変更する。

```bash
npx --yes --package=repomix@1.18.1 repomix --include 'src/**/*.ts' --no-file-summary --no-directory-structure --no-git-sort-by-changes --token-count-encoding o200k_base --output /path/to/all-source.xml
```

絞り込みは `--include 'src/server/common/**/*.ts,src/server/lobby/**/*.ts,src/shared/**/*.ts'`、圧縮比較は全文コマンドへ `--compress` を追加した。試用ツールのインストール先が本体のTypeScriptを解決できるかは別途確認する。

関連: [既存ツールの検証記録](tooling-verification.md)、[ワンショット比較の手順](one-shot-protocol.md)。本調査ではCI、ゲーム公開、リモートpushを行っていない。
