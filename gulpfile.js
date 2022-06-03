const gulp = require("gulp");
const sass = require('gulp-sass');
const fs = require('fs');
const cleanCSS = require('gulp-clean-css');
const htmlmin = require('gulp-htmlmin');
const pug = require('gulp-pug');
const ts = require('gulp-typescript');
const tsProject = ts.createProject('tsconfig.json');
const nodemon = require('gulp-nodemon');
const webpack = require('webpack-stream');

const pugPaths = { pages: ['app/client/views/*.pug'] };
const scssPaths = { pages: ['app/client/css/*.scss'] };
const resPaths = { pages: ['app/client/assets/**/*'] };
const srcPaths = 'app/client/src/index.js';
const serverSrcPaths = ['app/api/client.ts', 'app/server/**/*.ts'];
const distPath = 'dist';

const env = JSON.parse(fs.readFileSync('.env.json').toString());

gulp.task("build-client-views", () => {
    return gulp.src(pugPaths.pages)
        .pipe(pug({
            data: { env },
        }))
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest(distPath))
});
gulp.task("build-client-assets", () => gulp.src(resPaths.pages) .pipe(gulp.dest(distPath)));

gulp.task("build-client-scss", function () {
    return gulp.src(scssPaths.pages)
        .pipe(sass().on('error', sass.logError))
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(gulp.dest(distPath));
});

gulp.task('build-client-javascript', function() {
    const webpackConfig = require('./webpack.config');
    delete webpackConfig.entry;
    return gulp
        .src(srcPaths)
        .pipe(webpack(webpackConfig))
        .pipe(gulp.dest(distPath));
});

gulp.task('build-server-typescript', function() {
    return gulp.src(serverSrcPaths)
        .pipe(tsProject())
        .pipe(gulp.dest('build'));
});

gulp.task('build-client', gulp.parallel('build-client-views', 'build-client-scss', 'build-client-assets', 'build-client-javascript'));
gulp.task('build-server', gulp.parallel('build-server-typescript'));
gulp.task('build', gulp.series('build-server', 'build-client'));

gulp.task('watch-server-typescript', function (done) {
    nodemon({
        script: 'build/server.js',
        watch: serverSrcPaths,
        ext: 'ts',
        tasks: ['build-server'],
        done: done
    });
});

gulp.task('watch-client-javascript', function () {
    const webpackConfig = require('./webpack.config');
    delete webpackConfig.entry;
    webpackConfig.watch = true;
    webpackConfig.mode = 'development';
    return gulp
        .src(srcPaths)
        .pipe(webpack(webpackConfig))
        .pipe(gulp.dest(distPath));
});

gulp.task('watch-server', gulp.series('watch-server-typescript'));
gulp.task('watch-client', gulp.series('watch-client-javascript'));
gulp.task('watch', gulp.series('build', gulp.parallel('watch-client', 'watch-server')));
gulp.task('default', gulp.series('watch'));
