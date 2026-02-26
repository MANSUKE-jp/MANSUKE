/**
 * コンソールに Self-XSS 攻撃に対する警告メッセージを表示する
 * すべてのMANSUKEウェブアプリ/サイトで共通で使用される
 */
export const showConsoleWarning = () => {
    // メインタイトル
    console.log(
        '%cストップ！！',
        'color: #ff0000; font-size: 48px; font-weight: 900; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); padding: 10px 0;'
    );

    // 赤太文字の警告メッセージ
    console.log(
        '%cこのスペースに文字を入力したり、何かを貼り付けたりするよう指示された場合、あなたは確実に騙されています。',
        'color: #ff0000; font-size: 16px; font-weight: 700; line-height: 1.8;'
    );

    // Self-XSS の説明
    console.log(
        '%cSelf-XSSという攻撃手段で、悪意のある第三者があなたの個人情報を盗もうとしています。',
        'color: #333333; font-size: 14px; font-weight: 500; line-height: 1.8;'
    );

    // 対処法
    console.log(
        '%c入力するコードの意味が自分でわからない場合、ウィンドウを閉じて、指示した相手との連絡を断つべきです。',
        'color: #333333; font-size: 14px; font-weight: 500; line-height: 1.8;'
    );

    // 採用メッセージ
    console.log(
        '%cもしあなたが何をしているのかを理解しているならば、ぜひ私たちと一緒に働きましょう。\n%ccontact@mansuke.jp%c までお問い合わせください。',
        'color: #333333; font-size: 14px; font-weight: 500; line-height: 1.8;',
        'color: #1a73e8; font-size: 14px; font-weight: 700; text-decoration: underline; line-height: 1.8;',
        'color: #333333; font-size: 14px; font-weight: 500; line-height: 1.8;'
    );
};
