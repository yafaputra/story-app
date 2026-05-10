const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv && argv.mode === 'production';

    return {
        mode: isProduction ? 'production' : 'development',
        entry: './src/app.js',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'bundle.js',
            clean: true,
            publicPath: '/story-app/',
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './index.html',
                inject: false,
            }),
            new CopyWebpackPlugin({
                patterns: [
                    { from: 'sw.js', to: 'sw.js' },
                    { from: 'manifest.json', to: 'manifest.json' },
                    { from: 'icons', to: 'icons' },
                    { from: 'screenshots', to: 'screenshots' },
                    { from: 'src/styles/main.css', to: 'src/styles/main.css' },
                    { from: 'src/utils', to: 'src/utils' },
                    { from: 'src/pages', to: 'src/pages' },
                ],
            }),
        ],
        module: {
            rules: [{
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            }, ],
        },
        devServer: {
            static: './dist',
            port: 8080,
            open: true,
            historyApiFallback: true,
        },
    };
};