const gulp = require("gulp");
const browserify = require("browserify");
const source = require('vinyl-source-stream');
const uglify = require('gulp-uglify');
const sourcemaps = require('gulp-sourcemaps');
const buffer = require('vinyl-buffer');
const tsify = require("tsify");
const sass = require('gulp-sass');
const cleanCSS = require('gulp-clean-css');
const htmlmin = require('gulp-htmlmin');
const pug = require('gulp-pug');

const pugPaths = { pages: ['app/client/views/*.pug'] };
const scssPaths = { pages: ['app/client/css/*.scss'] };
const resPaths = { pages: ['app/client/assets/*'] };
const srcPaths = ['app/client/src/index.ts'];
const distPath = 'dist';

gulp.task("client-views", () => {
    return gulp.src(pugPaths.pages)
        .pipe(pug())
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest(distPath))
});
gulp.task("client-assets", () => gulp.src(resPaths.pages) .pipe(gulp.dest(distPath + '/assets')));

gulp.task("client-scss", function () {
    return gulp.src(scssPaths.pages)
        .pipe(sass().on('error', sass.logError))
        .pipe(cleanCSS({compatibility: 'ie8'}))
        .pipe(gulp.dest(distPath));
});


gulp.task("client-typescript", function () {
    return browserify({
        basedir: '.',
        debug: true,
        entries: srcPaths,
        cache: {},
        packageCache: {},
    })
        .plugin(tsify)
        .bundle()
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        //.pipe(uglify())
        .pipe(gulp.dest(distPath));
});

gulp.task('default', gulp.parallel('client-views', 'client-scss', 'client-assets', 'client-typescript'));
