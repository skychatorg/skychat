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
const ts = require('gulp-typescript');
const tsProject = ts.createProject('tsconfig.json');
const nodemon = require('gulp-nodemon');


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


gulp.task("build-client-typescript", function () {
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
