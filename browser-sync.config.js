/*
 | For up-to-date information about the options:
 |   http://www.browsersync.io/docs/options/
 */
module.exports = {
    files: ["**/*.css", "**/*.html", "**/*.js", "**/*.php", "**/*.json"],
    watch: true,
    server: false,
    serveStatic: [
        {
            route: '/fonts',
            dir:'/home/gnuk/workflow/common/fonts/',
        },
        {
            route: '/favicons',
            dir:'/home/gnuk/workflow/common/favicons/',
        }
    ],
    ui:false,
    open: false,
    notify: false,
    ghostMode: false,
}
