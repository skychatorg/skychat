const path = require('path');
const gulp = require("gulp");
const sass = require('gulp-sass');
const cleanCSS = require('gulp-clean-css');
const htmlmin = require('gulp-htmlmin');
const pug = require('gulp-pug');
const ts = require('gulp-typescript');
const tsProject = ts.createProject('tsconfig.server.json');
const nodemon = require('gulp-nodemon');
const webpack = require('webpack-stream');
const VueLoaderPlugin = require('vue-loader/lib/plugin');


const pugPaths = { pages: ['app/client/views/*.pug'] };
const scssPaths = { pages: ['app/client/css/*.scss'] };
const resPaths = { pages: ['app/client/assets/*'] };
const srcPaths = ['app/client/src/index.ts'];
const serverSrcPaths = ['app/server/**/*.ts'];
const distPath = 'dist';

gulp.task("build-client-views", () => {
    return gulp.src(pugPaths.pages)
        .pipe(pug())
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest(distPath))
});
gulp.task("build-client-assets", () => gulp.src(resPaths.pages) .pipe(gulp.dest(distPath + '/assets')));

gulp.task("build-client-scss", function () {
    return gulp.src(scssPaths.pages)
        .pipe(sass().on('error', sass.logError))
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(gulp.dest(distPath));
});

gulp.task('build-client-typescript', function() {
    return gulp
        .src('app/client/src/index.ts')
        .pipe(webpack({
            output: {
                filename: 'bundle.js'
            },
            module: {
                rules: [
                    {
                        test: /\.vue$/,
                        loader: 'vue-loader',
                        options: {
                            loaders: {
                                // Since sass-loader (weirdly) has SCSS as its default parse mode, we map
                                // the "scss" and "sass" values for the lang attribute to the right configs here.
                                // other preprocessors should work out of the box, no loader config like this necessary.
                                'scss': 'vue-style-loader!css-loader!sass-loader',
                                'sass': 'vue-style-loader!css-loader!sass-loader?indentedSyntax',
                            }
                            // other vue-loader options go here
                        }
                    },
                    {
                        test: /\.tsx?$/,
                        loader: 'ts-loader',
                        exclude: /node_modules/,
                        options: {
                            appendTsSuffixTo: [/\.vue$/],
                        }
                    },
                    {
                        test: /\.(png|jpg|gif|svg)$/,
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]?[hash]'
                        }
                    },
                    {
                        test: /\.css$/,
                        use: [
                            'vue-style-loader',
                            'css-loader'
                        ]
                    }
                ]
            },
            resolve: {
                extensions: ['.ts', '.js', '.vue', '.json'],
                alias: {
                    'vue$': 'vue/dist/vue.esm.js'
                }
            },
            devServer: {
                historyApiFallback: true,
                noInfo: true
            },
            performance: {
                hints: false
            },
            devtool: '#eval-source-map',
            plugins: [
                // make sure to include the plugin for the magic
                new VueLoaderPlugin()
            ]
        }))
        .pipe(gulp.dest(distPath));
});

gulp.task('build-server-typescript', function() {
    return gulp.src(serverSrcPaths)
        .pipe(tsProject())
        .pipe(gulp.dest('build'));
});

gulp.task('build-client', gulp.parallel('build-client-views', 'build-client-scss', 'build-client-assets', 'build-client-typescript'));
gulp.task('build-server', gulp.parallel('build-server-typescript'));
gulp.task('build', gulp.parallel('build-client', 'build-server'));

gulp.task('watch-server-monitor', function (done) {
    nodemon({
        script: 'build/server.js',
        watch: serverSrcPaths,
        ext: 'ts',
        tasks: ['build-server'],
        done: done
    });
});

gulp.task('watch-client-monitor', function () {
    return gulp.watch(['app/client/**/*'], gulp.series('build-client'));
});

gulp.task('watch-server', gulp.series('build-server', 'watch-server-monitor'));
gulp.task('watch-client', gulp.series('build-client', 'watch-client-monitor'));
gulp.task('watch', gulp.parallel('watch-client', 'watch-server'));
gulp.task('default', gulp.series('watch'));
