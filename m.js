'use strict';
let $ = require('jquery'),
	irc = require('irc')

let config = require('./config.json')

class Bundle {
	constructor(elem) {
		this.elem = elem
	}

	get element() {
		return this.elem
	}
}

class View {
	constructor(bundle) {
		this.bundle = bundle
	}

	render() {
		return $(this.bundle.element).html('')
	}

	createView(tag) {
		if (!tag) {
			tag = '<div/>'
		}
		return new View(new Bundle($(tag))).render()
	}
}

class NoteView extends View {
	constructor(bundle, children) {
		super(bundle)
		this.children = children
	}

	render() {
		return $(super.render()).append($(this.createView()).text('note:').css({
			'color': 'red',
			'display': 'inline-block',
			'margin-right': '5px'
		})).append(this.children.map(function(c) {
			return $(c.render()).css({
				'display': 'inline-block'
			})
		}))
	}
}

class ExpandView extends View {
	constructor(bundle, lv, btxt) {
		super(bundle)
		this.lv = lv
		this.btxt = btxt
	}

	render() {
		let exp = $(this.createView('<pre/>')).text(this.btxt).css({
			'font-size': 10,
			'overflow': 'auto',
			'word-wrap': 'normal',
			'white-space': 'pre',
			'color': 'rgb(0,0,0)',
			'background-color': 'white',
			'padding': '10px',
			'border-radius': '3px'
		})
		return $(super.render()).append($(this.lv).click(function() {
			exp.slideToggle(200, 'linear')
		})).css({
			'color': 'cyan'
		}).append(exp.hide())
	}
}

class ListView extends View {
	constructor(bundle, view, elems) {
		super(bundle)
		this.view = view
		this.elems = elems
	}

	// returns rendered element
	render() {
		let v = this.view, b = this.createView
		return $(super.render()).append(this.elems.map(function(i) {
			return new v(new Bundle(b()), i).render()
		}))
	}
}

class ChanNameView extends View {
	constructor(bundle, chan) {
		super(bundle)
		this.chan = chan
	}

	render() {
		return $(super.render()).append($(this.createView()).text(this.chan).css({'background-color': '#708EA4', 'color': '#29516D'}))
	}
}

class MessageView extends View {
	constructor(bundle, msg) {
		super(bundle)
		this.msg = msg
	}

	render() {
		return $(super.render()).addClass('msg')
	}
}

class RegisteredMessageView extends MessageView {
	constructor(bundle, msg) {
		super(bundle, msg)
		let c = this.createView
		this.note = new NoteView(bundle, [{
			render: function() {
				return $(c()).text('connected to server')
			}
		}])
	}

	render() {
		return $(super.render()).append(this.note.render())
	}
}

class MotdMessageView extends MessageView {
	constructor(bundle, motd) {
		super(bundle, null)
		this.expv = new ExpandView(bundle, $(this.createView()).text('motd'), motd)
	}

	render() {
		return $(super.render()).append(this.expv.render())
	}
}

class NamesMessageView extends ListView {
	constructor(bundle, channel, names) {
		super(bundle, function(bundle, i) {
			// return an object with a render method
			return {
				render: function() {
					$(bundle.element).text(i)
				}
			}
		}, Object.keys(names))
		this.chan = new ChanNameView(channel)
	}

	render() {
		return $(super.render()).append(this.chan.render()).append($(this.createView()).text(' has members:'))
	}
}

class TopicMessageView extends MessageView {
	constructor(bundle, channel, topic, nick, message) {
		super(bundle, message)
		this.expv = new ExpandView(bundle, $(this.createView()).text('topic at '+channel+' set by '+nick), topic)
	}

	render() {
		return $(super.render()).append(this.expv.render())
	}
}

class JoinMessageView extends MessageView {
	constructor(bundle, channel, nick, message) {
		super(bundle, message)
		this.chan = channel
		this.nick = nick
	}

	render() {
		return $(super.render()).append($(this.createView()).text(this.nick+' joined '+this.chan))
	}
}

class MessageListView extends ListView {
	constructor(bundle, chan) {
		super(bundle, function(bundle, i) {
			let r = i(bundle)
			this.render = function() {
				return r.render()
			}
		}, [])
		this.chan = chan
	}

	append(msg) {
		this.elems.push(msg)
		this.render()
	}
}

class Channel {
	constructor(client, chan) {
		this.client = client
		this.chan = chan
	}

	toString() {
		return this.chan
	}

	connect(f) {
		let c = {
			client: this.client(),
			chan: this.chan,
			disconnect: function(f) {
				this.client.part(this.chan, f)
			}
		}
		c.client.join(this.chan, function() {
			f(c)
		})
	}
}

class ChannelView extends View {
	constructor(bundle, chan) {
		super(bundle)
		this.chan = chan
	}

	// returns rendered element
	render() {
		let chan = this.chan
		return $(super.render()).text(this.chan).css({
			'margin': '5px'
		}).click(function() {
			console.log('attempting to connect to '+chan.chan+'...')
			chan.connect(function(c) {
				let client = c.client
				console.log('connected to '+chan.chan)

				// Replace view with new channel view
				let msg = new MessageListView(new Bundle($('#content')), chan)
				msg.render()

				$(document.body).keypress(function(e) {
					if (e.keyCode == 98) {
						c.disconnect(function() {
							init() // reinit
						})
					}
				})

				client.addListener('error', function(message) {
					msg.append(function(bundle) {
						return {
							render: function() {
								$(new View(bundle).render()).text(JSON.stringify(message))
							}
						}
					})
				})
				client.addListener('registered', function(message) {
					msg.append(function(bundle) {
						return new RegisteredMessageView(bundle, message)
					})
				})
				client.addListener('motd', function(motd) {
					msg.append(function(bundle) {
						return new MotdMessageView(bundle, motd)
					})
				})
				client.addListener('names', function(channel, names) {
					msg.append(function(bundle) {
						return new NamesMessageView(bundle, channel, names)
					})
				})
				client.addListener('topic', function(channel, topic, nick, message) {
					msg.append(function(bundle) {
						return new TopicMessageView(bundle, channel, topic, nick, message)
					})
				})
				client.addListener('join', function(channel, nick, message) {
					msg.append(function(bundle) {
						return new JoinMessageView(bundle, channel, nick, message)
					})
				})
				// client.addListener('part', function(channel, nick, reason, message) {
				// 	console.log(nick+' left '+channel+': '+reason)
				// })
				// client.addListener('quit', function(nick, reason, channels, message) {
				// 	console.log(nick+' quit '+channels+': '+reason)
				// })
				// client.addListener('kick', function(channel, nick, by, reason, message) {
				// 	console.log(nick+' kicked from '+channel+' by '+by+': '+reason)
				// })
				// client.addListener('kill', function(nick, reason, channels, message) {
				// 	console.log(nick+' killed from '+channels+': '+reason)
				// })
				// client.addListener('message#', function(nick, to, text, message) {
				// 	console.log(nick+'=>'+to+': '+text)
				// })
				// client.addListener('selfMessage', function(to, text) {
				// 	console.log('you=>'+to+': '+text)
				// })
				// client.addListener('notice', function(nick, to, text, message) {
				// 	console.log('[notice] '+nick+'=>'+to+': '+text)
				// })
				// client.addListener('ping', function(server) {
				// 	console.log('[ping] '+server)
				// })
				// client.addListener('pm', function(nick, text, message) {
				// 	console.log(nick+'=>you: '+text)
				// })
				// client.addListener('nick', function(oldnick, newnick, channels, message) {
				// 	console.log(oldnick+' is now '+newnick+' on '+channels)
				// })
				// client.addListener('invite', function(channel, from, message) {
				// 	console.log('invite to '+channel+' from '+from)
				// })
				// client.addListener('+mode', function(channel, by, mode, argument, message) {})
				// client.addListener('-mode', function(channel, by, mode, argument, message) {})
				// client.addListener('whois', function(info) {})
				// client.addListener('error', function(message) {
				// 	console.log('error: ', message);
				// })
				// client.addListener('action', function(from, to, text, message) {})
				// client.addListener('channellist', function(channel_list) {})
				// client.addListener('raw', function(message) {})
				//
				// // Client to Client
				// client.addListener('ctcp-notice', function(from, to, text, message) {})
				// client.addListener('ctcp-privmsg', function(from, to, text, message) {})
				// client.addListener('ctcp-version', function(from, to, message) {})
			})
		})
	}
}

// IRC Client
let client = function() {
	let c = new irc.Client('irc.freenode.net', 'erktest', config.client);
	// Set up chan handlers to update message list view
	c.addListener('error', function(message) {
		console.log('An error occured: '+JSON.stringify(message))
	})
	return c
}

// Set new UI
function init() {
	new ListView(new Bundle($('#content')), ChannelView, config.channels.map(function(chan) {
		return new Channel(client, chan)
	})).render()
}
init()
