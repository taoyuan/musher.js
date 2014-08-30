module.exports = function (grunt) {
    // * Read command-line switches
    // - Read in --browsers CLI option; split it on commas into an array if it's a string, otherwise ignore it
    var browsers = typeof grunt.option('browsers') == 'string' ? grunt.option('browsers').split(',') : undefined;

    var banner = '/***********************************************\n' +
        '* <%= pkg.description %> v<%= pkg.version %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
        '* \n' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>.\n' +
        '* Licensed <%= pkg.license %> \n' +
        '* \n' +
        '* Date: <%= grunt.template.today("yyyy-mm-dd HH:MM") %>\n' +
        '***********************************************/\n';

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        testFiles: { //unit & e2e goes here
            karmaUnit: 'config/karma.conf.js'
        },
        execute: {
            startMosca: {
                options: {
                    "http-port": 3883 // ws listen port
                },
                call: function (grunt, options, async) {
                    var done = async();
                    require('./test/support').start(options, function (err, server) {
                        console.log('Mostel server is up and running');
                        grunt.mostelServer = server;
                        done();
                    });
                }
            },
            stopMosca: {
                call: function (grunt, options, async) {
                    if (grunt.mostelServer) {
                        var done = async();
                        grunt.mostelServer.close(function () {
                            console.log('Mostel server is closed');
                            done();
                        });
                        grunt.mostelServer = null;
                    }
                }
            }
        },
        mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/unit/*.test.js']
            }
        },
        karma: {
            unit: {
                options: {
                    configFile: '<%= testFiles.karmaUnit %>',
                    autoWatch: false,
                    singleRun: true,
                    browsers: browsers || ['Chrome']
                }
            }
        },
        browserify: {
            options: {
                browserifyOptions: {
                    standalone: 'musher'
                }
            },
            dist: {
                files: {
                    'build/<%= pkg.name %>.browserify.js': 'src/musher.browserify.js'
                }
            }
        },
        concat: {
            options: {
                banner: banner
            },
            prod: {
                options: {
                    stripBanners: {
                        block: true,
                        line: true
                    }
                },
                files: {
                    'build/<%= pkg.name %>.js': 'build/<%= pkg.name %>.browserify.js',
                    'build/<%= pkg.name %>-all.js': ['bower_components/bower-mqttws/mqttws31.js', 'build/<%= pkg.name %>.browserify.js']
                }
            }
        },
        uglify: {
            options: {
                banner: banner
            },
            build: {
                files: {
                    'build/<%= pkg.name %>.min.js': 'build/<%= pkg.name %>.js',
                    'build/<%= pkg.name %>-all.min.js': 'build/<%= pkg.name %>-all.js'
                }
            }
        },
        clean: {
            build: 'build/<%= pkg.name %>.browserify.js'
        }
    });

    // Load grunt-karma task plugin
    grunt.loadNpmTasks('grunt-karma');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-execute');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('test-mocha', ['mochaTest']);
    grunt.registerTask('test-karma', ['execute:startMosca', 'karma:unit', 'execute:stopMosca']);
    grunt.registerTask('test', ['test-mocha', 'test-karma']);

    // Load grunt-browserify task plugin
    grunt.loadNpmTasks('grunt-browserify');
    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('build', ['browserify', 'concat', 'uglify', 'clean']);

    grunt.registerTask('default', ['build', 'test']);

};