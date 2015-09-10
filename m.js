(function () {
    'use strict';
    let $ = require('jquery'),
        irc = require('irc');

    class Bundle {
        constructor(elem) {
            this.elem = elem;
            this.main = $('#content');
        }

        get element() {
            return this.elem;
        }
    };

    class View {
        constructor(bundle) {
            if (!bundle) {
                this.bundle = this.createBundle();
            } else {
                this.bundle = bundle;
            }
        }

        asMainView() {
            $(this.bundle.main).html('').append(this.render());
        }

        render() {
            return $(this.bundle.element).html('');
        }

        createBundle(tag) {
            if (!tag) {
                tag = '<div/>';
            }
            return new Bundle($(tag));
        }
    };

    class NoteView extends View {
        constructor(bundle, children) {
            super(bundle);
            this.children = children;
        }

        render() {
            return $(super.render()).append($(new View().render())
            .text('note:').css({
                'color': 'red',
                'display': 'inline-block',
                'margin-right': '5px'
            })).append(this.children.map(function(c) {
                return $(c.render()).css({
                    'display': 'inline-block'
                });
            }));
        }
    };

    class ExpandView extends View {
        constructor(bundle, lv, btxt) {
            super(bundle);
            this.lv = lv;
            this.btxt = btxt;
        }

        render() {
            let exp = $(new View(this.createBundle('<pre/>')).render())
            .text(this.btxt).css({
                'font-size': 10,
                'overflow': 'auto',
                'word-wrap': 'normal',
                'white-space': 'pre-wrap',
                'color': 'white',
                // 'background-color': 'white',
                'padding': '10px',
                'border-radius': '3px'
            });
            return $(super.render()).append($(this.lv).click(function() {
                exp.toggle();
            })).css({
                'color': 'cyan'
            }).append(exp.hide());
        }
    };

    class ListView extends View {
        constructor(bundle, view, elems) {
            super(bundle);
            this.view = view;
            this.elems = elems;
        }

        // returns rendered element
        render() {
            let v = this.view;
            return $(super.render()).append(this.elems.map(function(i) {
                return new v(new View().bundle, i).render();
            }));
        }
    };

    class ChanNameView extends View {
        constructor(bundle, chan) {
            super(bundle);
            this.chan = chan;
        }

        render() {
            return $(super.render()).append($(new View().render())
            .text(this.chan).css({
                'background-color': '#708EA4',
                'color': '#29516D'
            }));
        }
    };

    class MessageView extends View {
        constructor(bundle, msg) {
            super(bundle);
            this.msg = msg;
        }

        render() {
            return $(super.render()).addClass('msg');
        }
    };

    class RegisteredMessageView extends MessageView {
        constructor(bundle, msg) {
            super(bundle, msg);
            this.note = new NoteView(bundle, [{
                render: function() {
                    return $(new View().render()).text('connected to server');
                }
            }]);
        }

        render() {
            return $(super.render()).append(this.note.render());
        }
    };

    class MotdMessageView extends MessageView {
        constructor(bundle, motd) {
            super(bundle);
            this.expv = new ExpandView(bundle, $(new View().render())
            .text('motd'), motd);
        }

        render() {
            return $(super.render()).append(this.expv.render());
        }
    };

    class NamesMessageView extends MessageView {
        constructor(bundle, channel, names) {
            super(bundle);
            this.expv = new ExpandView(bundle, $(new View().render())
            .text('members'), new ListView(bundle, function(bundle, i) {
                // return an object with a render method
                class v extends View {
                    render() {
                        return $(super.render()).text(JSON.stringify(i));
                    }
                };
                return new v(bundle);
            }, Object.keys(names)));
        }

        render() {
            return $(super.render()).append(this.expv.render());
        }
    };

    class TopicMessageView extends MessageView {
        constructor(bundle, channel, topic, nick, message) {
            super(bundle, message);
            this.expv = new ExpandView(bundle, $(new View().render())
            .text('topic at ' + channel + ' set by ' + nick), topic);
        }

        render() {
            return $(super.render()).append(this.expv.render());
        }
    };

    class JoinMessageView extends MessageView {
        constructor(bundle, channel, nick, message) {
            super(bundle, message);
            this.chan = channel;
            this.nick = nick;
        }

        render() {
            return $(super.render()).append($(new View().render())
            .text(this.nick + ' joined ' + this.chan));
        }
    };

    class PartMessageView extends MessageView {
        constructor(bundle, channel, nick, reason, message) {
            super(bundle, message);
            this.chan = channel;
            this.nick = nick;
            this.reason = reason;
        }

        render() {
            return $(super.render()).append($(new View().render())
            .text(this.nick + ' left ' + this.chan + ': ' + this.reason));
        }
    };

    class QuitMessageView extends MessageView {
        constructor(bundle, nick, reason, channels, message) {
            super(bundle, message);
            this.chans = channels;
            this.nick = nick;
            this.reason = reason;
        }

        render() {
            let self = this;
            return $(super.render()).append($(new View().render())
            .text(this.nick + ' quit ' + function() {
                let s = '';
                self.chans.map(function(chan) {
                    if (s != '') {
                        s += ', ';
                    }
                    s += chan;
                });
                return s;
                }() + ': ' + this.reason));
        }
    };

    class KickMessageView extends MessageView {
        constructor(bundle, channel, nick, by, reason, message) {
            super(bundle, message);
            this.chan = channel;
            this.nick = nick;
            this.reason = reason;
            this.by = by;
        }

        render() {
            return $(super.render()).append($(new View().render())
            .text(this.nick + ' was kicked from ' + this.chan + ' by ' +
            this.by + ': ' + this.reason));
        }
    };

    class KillMessageView extends MessageView {
        constructor(bundle, nick, reason, channels, message) {
            super(bundle, message);
            this.chans = channels;
            this.nick = nick;
            this.reason = reason;
        }

        render() {
            return $(super.render()).append($(new View().render())
            .text(this.nick + ' was killed from ' + function() {
                    let s = '';
                    this.chans.map(function(chan) {
                        if (s != '') {
                            s += ', ';
                        }
                        s += chan;
                    });
                    return s;
                }() + ': ' + this.reason));
        }
    };

    class MsgMessageView extends MessageView {
        constructor(bundle, nick, to, text, message) {
            super(bundle, message);
            this.nick = nick;
            this.to = to;
            this.txt = text;
        }

        render() {
            return $(super.render()).append($(new View().render())
            .text(this.nick + '=>' + this.to + ': ' + this.txt));
        }
    };

    class MessageListView extends ListView {
        constructor(bundle) {
            super(bundle, function(bundle, i) {
                let r = i(bundle);
                this.render = function() {
                    return r.render();
                };
            }, []);
        }

        append(msg) {
            this.elems.push(msg);
            this.render();
        }
    };

    class Channel {
        constructor(client, chan, nick) {
            this.client = client;
            this.chan = chan;
            this.nick = nick;
        }

        toString() {
            return this.chan;
        }

        disconnect(f) {
            this.client.addListener('error', function(message) {
                console.error('connection failed: ' + JSON.stringify(message));
                f(false);
            });
            this.client.part(this.chan, function(nick, reason, message) {
                // unregister handler
                self.client.addListener('error', function() {});
                f(true);
            });
        }

        // Connect
        // calls callback f with this channel and true on success, false on failure.
        connect(f) {
            let self = this, unreg = function() {
                // unregister handlers
                self.client.addListener('join', function() {});
                self.client.addListener('error', function() {});
            };
            this.client.addListener('error', function(message) {
                unreg();
                console.error('connection failed: ' + JSON.stringify(message));
                f(self, false);
            });
            this.client.addListener('join', function(channel, nick, message) {
                if (nick == self.nick) {
                    unreg();
                    self.chan = channel;
                    f(self, true);
                }
            });
            this.client.join(this.chan);
        }
    };

    class ChannelView extends View {
        constructor(bundle, chan) {
            super(bundle);
            this.chan = chan;
        }

        // returns rendered element
        render() {
            let bundle = this.bundle;
            let chan = this.chan;
            return $(super.render()).text(this.chan).css({
                'margin': '5px',
                'cursor': 'pointer',
                'color': 'pink'
            }).click(function() {
                $('#content').text('joining ' + chan.chan + '...');
                chan.connect(function(c, success) {
                    if (!success) {
                        // Abort
                        init().asMainView(); // reinit
                        return;
                    }
                    let client = c.client;
                    $(document.body).keypress(function(e) {
                        if (e.keyCode == 98) {
                            // b pressed
                            c.disconnect(function(success) {
                                init().asMainView(); // reinit
                            });
                        } else if (e.keyCode == 115) {
                            console.log('say activated');
                            // s pressed
                            class v extends View {
                                render() {
                                    return $(super.render()).append(
                                        $(new View(
                                            this.createBundle('<textarea />')
                                        ).render()).css({
                                        'resize': 'none',
                                        'overflow': 'auto',
                                        'outline': 'none',
                                        'background-color': 'white',
                                        'color': 'black',
                                        'width': '100%',
                                        'height': '100%'
                                    }).focus()).css({
                                        'positon': 'absolute',
                                        'bottom': '0px',
                                        'left': '0px',
                                        'width': '100%',
                                        'height': '20px'
                                    });
                                }
                            }
                            new v().render();
                        }
                    });

                    // Replace view with new channel view
                    let msg = new MessageListView(new Bundle($('#content')));
                    msg.render();

                    client.addListener('error', function(message) {
                        msg.append(function(bundle) {
                            return {
                                render: function() {
                                    $(new View(bundle).render())
                                    .text(JSON.stringify(message));
                                }
                            };
                        });
                    });
                    client.addListener('registered', function(message) {
                        msg.append(function(bundle) {
                            return new RegisteredMessageView(bundle, message);
                        });
                    });
                    client.addListener('motd', function(motd) {
                        msg.append(function(bundle) {
                            return new MotdMessageView(bundle, motd);
                        });
                    });
                    client.addListener('names', function(channel, names) {
                        msg.append(function(bundle) {
                            return new NamesMessageView(bundle, channel, names);
                        });
                    });
                    client.addListener('topic', function(channel, topic, nick,
                        message) {
                        msg.append(function(bundle) {
                            return new TopicMessageView(bundle, channel, topic,
                                nick, message);
                        });
                    });
                    client.addListener('join', function(channel, nick, message) {
                        msg.append(function(bundle) {
                            return new JoinMessageView(bundle, channel, nick,
                                message);
                        });
                    });
                    client.addListener('part', function(channel, nick, reason,
                        message) {
                        msg.append(function(bundle) {
                            return new PartMessageView(bundle, channel, nick,
                                reason, message);
                        });
                    });
                    client.addListener('quit', function(nick, reason, channels,
                        message) {
                        msg.append(function(bundle) {
                            return new QuitMessageView(bundle, nick, reason,
                                channels, message);
                        });
                    });
                    client.addListener('kick', function(channel, nick, by, reason,
                        message) {
                        msg.append(function(bundle) {
                            return new KickMessageView(bundle, channel, nick, by,
                                reason, message);
                        });
                    });
                    client.addListener('kill', function(nick, reason, channels,
                        message) {
                        msg.append(function(bundle) {
                            return new KillMessageView(bundle, nick, reason,
                                channels, message);
                        });
                    });
                    client.addListener('message#', function(nick, to, text,
                        message) {
                        msg.append(function(bundle) {
                            return new MsgMessageView(bundle, nick, to, text,
                                message);
                        });
                    });
                    client.addListener('selfMessage', function(to, text) {
                        msg.append(function(bundle) {
                            return new MsgMessageView(bundle, 'you', to, text,
                            message);
                        });
                    });
                    // client.addListener('notice', function(nick, to, text,
                    // message) {
                    //     console.log('[notice] '+nick+'=>'+to+': '+text)
                    // })
                    // client.addListener('ping', function(server) {
                    //     console.log('[ping] '+server)
                    // })
                    // client.addListener('pm', function(nick, text, message) {
                    //     console.log(nick+'=>you: '+text)
                    // })
                    // client.addListener('nick', function(oldnick, newnick,
                    // channels, message) {
                    //     console.log(oldnick+' is now '+newnick+' on '+channels)
                    // })
                    // client.addListener('invite', function(channel, from,
                    // message) {
                    //     console.log('invite to '+channel+' from '+from)
                    // })
                    // client.addListener('+mode', function(channel, by, mode,
                    // argument, message) {})
                    // client.addListener('-mode', function(channel, by, mode,
                    // argument, message) {})
                    // client.addListener('whois', function(info) {})
                    // client.addListener('error', function(message) {
                    //     console.log('error: ', message);
                    // })
                    // client.addListener('action', function(from, to, text,
                    // message) {})
                    // client.addListener('channellist', function(channel_list) {})
                    // client.addListener('raw', function(message) {})
                    //
                    // // Client to Client
                    // client.addListener('ctcp-notice', function(from, to, text,
                    // message) {})
                    // client.addListener('ctcp-privmsg', function(from, to, text,
                    // message) {})
                    // client.addListener('ctcp-version', function(from, to,
                    // message) {})
                });
            });
        }
    };

    let cname = 'erktest';

    // Set new UI
    function init(client) {
        let channels = ['#firefox', '#haskell', '#go-nuts'];
        return new ListView(new View().bundle, ChannelView,
        channels.map(function(chan) {
            return new Channel(client, chan, cname);
        }));
    }

    (function f(f) {
        (function() {
            class v extends View {
                render() {
                    $(super.render()).text('connecting...');
                }
            }
            new v(new Bundle()).asMainView();
        })();

        let c = new irc.Client('irc.mozilla.org', 'erktest', {
            autoConnect: false,
            userName: cname,
            realName: 'Erk Test Client'
        });
        // Set up chan handlers to update message list view
        c.addListener('error', function(message) {
            console.log('An error occured: ' + JSON.stringify(message));
            f(c, false);
        });
        c.connect(function() {
            f(c, true);
        });
    })(function(c, success) {
        if (success) {
            init(c).asMainView();
        } else {
            // Connection error
            class v extends View {
                render() {
                    $(super.render()).text('error connecting');
                }
            }
            new v().asMainView();
        }
    });
})();
