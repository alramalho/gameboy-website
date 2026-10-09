import { Queue } from "./queue";
import { playSound as playEffect, unlockSound, Sound } from "./sound";

/**
 * The Game Boy is a frame around the game (alramalho/pokemon-website), which runs
 * in an iframe in the screen. Its D-pad, A, B and START are the game's buttons: pressing
 * one sends it to the game, and letting go releases it, so holding a direction keeps
 * walking. SELECT shows the help menu; the Konami code flashes the Game Boy's colour.
 */

// Where the game is served: pokemon.alexramalho.dev (Vercel project pokemon-website), or the
// game's dev server while developing. GAME_URL overrides it (e.g. GAME_URL=http://localhost:4000 yarn start).
const GAME_URL = process.env.GAME_URL
  || (process.env.NODE_ENV === "production" ? "https://pokemon.alexramalho.dev" : "http://localhost:5188");

type GameButton = "up" | "down" | "left" | "right" | "a" | "b" | "start"
type Action = GameButton | "select"

// Game Boy Advance SP shells: platinum, cobalt, flame, onyx, pearl pink, graphite.
const gameboyColors = [`#bbbcc1`, `#3b55a4`, `#c73a2c`, `#2e3036`, `#e9b8c4`, `#6d7078`]

let game: HTMLIFrameElement
const last10Moves = new Queue<Action>(10)

function init() {
  console.log('⭐ Konami? ⭐')
  createGame()
  createGameboy()
}

/** Put the game in the screen. */
function createGame() {
  game = document.createElement('iframe')
  game.className = 'game'
  game.src = GAME_URL
  game.title = "Alex's House"
  game.allow = 'autoplay; fullscreen'
  document.querySelector('.display').appendChild(game)
}

/** Tell the game a button went down or up. */
function sendToGame(message: { kind: 'button', button: GameButton, down: boolean } | { kind: 'key', code: string, down: boolean }) {
  game.contentWindow?.postMessage(message, new URL(GAME_URL).origin)
}

function playSound(id: string) {
  const audio = document.getElementById(id) as HTMLAudioElement;
  audio.play();
}

function isHelpMenuOn() {
  const helpMenu = document.querySelector('.help-menu') as HTMLElement
  return helpMenu.style.display == "block"
}

function toggleHelpMenu() {
  const helpMenu = document.querySelector('.help-menu') as HTMLElement
  helpMenu.style.display = isHelpMenuOn() ? 'none' : 'block'
}

function triggerKonami() {
  function assignGameboyRandomColor() {
    document.documentElement.style.setProperty('--gameboyColor', gameboyColors[Math.floor(Math.random() * gameboyColors.length)]);
  }

  playSound('konami')

  const r = setInterval(() => {
    assignGameboyRandomColor()
  }, 200)

  setTimeout(() => {
    clearInterval(r)
  }, 1000)
}

/** A button was pressed (on the Game Boy or the keyboard): the page's own reactions to it. */
function fireControl(command: Action) {
  switch (command) {
    case "b":
      if (isHelpMenuOn()) toggleHelpMenu();
      break
    case "select":
      toggleHelpMenu()
      break
  }
  last10Moves.enqueue(command)

  const konamiCode: Action[] = ['up', 'up', 'down', 'down', 'left', 'left', 'right', 'right', 'b', 'a']
  const lastMoves = last10Moves.getArray()
  if (lastMoves.length == 10 && lastMoves.every((move, i) => move == konamiCode[i])) {
    triggerKonami()
  }
}

function createGameboy() {

  // https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  window.addEventListener('resize', () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

  /** A Game Boy button that is held down for as long as it's pressed (mouse or finger). */
  function createButton(action: Action, innerHTML: string, className: string) {
    const button = document.createElement('div')
    button.innerHTML = innerHTML
    button.className = className
    const isGameButton = action != "select"
    let down = false
    const release = () => {
      if (!down) return
      down = false
      button.classList.remove('pressed')
      if (isGameButton) sendToGame({ kind: 'button', button: action as GameButton, down: false })
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      try {
        button.setPointerCapture(event.pointerId) // keep the press even if the finger slides off
      } catch { }
      down = true
      button.classList.add('pressed')
      if (isGameButton) sendToGame({ kind: 'button', button: action as GameButton, down: true })
      fireControl(action)
    })
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    button.addEventListener('lostpointercapture', release)
    button.addEventListener('contextmenu', (event) => event.preventDefault())
    return button
  }

  // The D-pad is one surface, like the real one's single rocking piece: the direction held is
  // wherever the finger is, from the pad's centre, so it can roll from up to left to down
  // without lifting. (Four separate buttons would each keep the finger that pressed them.)
  const DPADWrapper = document.querySelector('.dpad')
  for (const direction of ['up', 'left', 'right', 'down']) {
    const arm = document.createElement('div')
    arm.className = direction
    DPADWrapper.appendChild(arm)
  }
  const middle = document.createElement('div')
  middle.className = 'middle'
  DPADWrapper.appendChild(middle)
  createDpad(document.querySelector('.dpad-well') as HTMLElement)

  const ABWrapper = document.querySelector('.a-b')
  ABWrapper.appendChild(createButton("b", '<span>B</span>', 'b'))
  ABWrapper.appendChild(createButton("a", '<span>A</span>', 'a'))

  const StartSelectWrapper = document.querySelector('.start-select')
  StartSelectWrapper.appendChild(createButton("select", 'SELECT', 'select'))
  StartSelectWrapper.appendChild(createButton("start", 'START', 'start'))

  // Keys pressed while the page (not the game) has focus: pass them on to the game.
  // Once you click into the game it hears the keyboard itself.
  const KEY_ACTIONS: Record<string, Action> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyZ: 'a', Enter: 'start', KeyX: 'b', Escape: 'b', Backspace: 'b',
    ShiftRight: 'select', ShiftLeft: 'select', KeyH: 'select',
  }
  document.addEventListener('keydown', (event) => {
    const action = KEY_ACTIONS[event.code]
    if (action || event.code == 'Space' || /^Key[WASD]$/.test(event.code)) event.preventDefault()
    if (event.repeat) return
    sendToGame({ kind: 'key', code: event.code, down: true })
    if (action) fireControl(action)
    if (action == 'select') showPressed(action, true)
  })
  document.addEventListener('keyup', (event) => {
    sendToGame({ kind: 'key', code: event.code, down: false })
    const action = KEY_ACTIONS[event.code]
    if (action == 'select') showPressed(action, false)
  })

  // The game says whenever one of its buttons goes down or up, whether a key or a Game Boy
  // button did it, so the Game Boy shows it pressed: the arrows light up the D-pad, Z the A...
  window.addEventListener('message', (event) => {
    if (event.source !== game.contentWindow) return
    if (event.data?.kind === 'held') showPressed(event.data.button, !!event.data.down)
    // The game's sound effects play here, where the taps are (see sound.ts).
    if (event.data?.kind === 'sound') playEffect(event.data.sound as Sound)
    if (event.data?.kind === 'showcase-open') openShowcase(event.data.module, event.data.options)
    if (event.data?.kind === 'showcase-press') showcase?.press(event.data.button)
  })

  // Browsers only allow sound after a tap or key press on the page, so start it with the first.
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) {
    document.addEventListener(type, unlockSound, { passive: true })
  }

  // iOS Safari ignores touch-action and user-scalable=no for double-tap and pinch zoom, so
  // mashing A or B zoomed the page in. Cancel a second tap that lands soon after the last one,
  // and the pinch gesture. The buttons listen to pointer events, which still arrive.
  let lastTouchEnd = 0
  document.addEventListener('touchend', (event) => {
    const now = event.timeStamp
    if (now - lastTouchEnd < 350) event.preventDefault()
    lastTouchEnd = now
  }, { passive: false })
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false })
  }
}

/**
 * Touch or click anywhere in the D-pad's dip: the finger's position from the centre picks the
 * direction, and moving the finger into another quarter switches to it. Near the diagonals the
 * direction already held wins unless the finger is clearly on the other side, so it doesn't
 * flicker when the thumb rests between two arms. A tiny dead zone in the middle holds nothing.
 */
function createDpad(pad: HTMLElement) {
  let finger: number | undefined
  let held: GameButton | undefined

  const hold = (direction: GameButton | undefined) => {
    if (direction === held) return
    if (held) {
      showPressed(held, false)
      sendToGame({ kind: 'button', button: held, down: false })
    }
    held = direction
    if (held) {
      showPressed(held, true)
      sendToGame({ kind: 'button', button: held, down: true })
      fireControl(held)
    }
  }

  const directionAt = (event: PointerEvent): GameButton | undefined => {
    const box = pad.getBoundingClientRect()
    const dx = event.clientX - (box.left + box.width / 2)
    const dy = event.clientY - (box.top + box.height / 2)
    if (Math.hypot(dx, dy) < box.width * 0.06) return undefined
    const horizontal: GameButton = dx < 0 ? 'left' : 'right'
    const vertical: GameButton = dy < 0 ? 'up' : 'down'
    const stickiness = 1.25
    if (held === horizontal && Math.abs(dy) < Math.abs(dx) * stickiness) return horizontal
    if (held === vertical && Math.abs(dx) < Math.abs(dy) * stickiness) return vertical
    return Math.abs(dx) > Math.abs(dy) ? horizontal : vertical
  }

  pad.addEventListener('pointerdown', (event) => {
    if (finger !== undefined) return
    event.preventDefault()
    finger = event.pointerId
    try {
      pad.setPointerCapture(event.pointerId) // keep following the finger even off the pad
    } catch { }
    hold(directionAt(event))
  })
  pad.addEventListener('pointermove', (event) => {
    if (event.pointerId === finger) hold(directionAt(event))
  })
  const lift = (event: PointerEvent) => {
    if (event.pointerId !== finger) return
    finger = undefined
    hold(undefined)
  }
  pad.addEventListener('pointerup', lift)
  pad.addEventListener('pointercancel', lift)
  pad.addEventListener('lostpointercapture', lift)
  pad.addEventListener('contextmenu', (event) => event.preventDefault())
}

/**
 * One of Alex's paintings, lifted out of the game in 3D: it leaves the Game Boy's screen from
 * where it was in the game and is shown over the whole page. The code for it lives with the game
 * (pokemon-website, src/showcase/) and is loaded from there; the game still hears A and B and
 * passes them on (showcase-press), and is told when it's over.
 */
type Rect = { x: number, y: number, width: number, height: number }
let showcase: { press(button: 'a' | 'b'): void } | undefined

// Parcel would try to bundle a plain import(); this loads the module from the game's server.
const importFromGame = new Function('url', 'return import(url)') as (url: string) => Promise<any>

async function openShowcase(module: string, options: any) {
  const origin = new URL(GAME_URL).origin
  const fromGame = (url: unknown) => typeof url === 'string' && new URL(url).origin === origin
  if (showcase || !fromGame(module) || !fromGame(options?.image) || !fromGame(options?.mini)) return
  // The game measured in its own pixels: move its rects onto the page.
  const screen = game.getBoundingClientRect()
  const k = screen.width / game.clientWidth
  const onPage = (r: Rect): Rect => ({ x: screen.left + r.x * k, y: screen.top + r.y * k, width: r.width * k, height: r.height * k })
  const reply = (message: object) => game.contentWindow?.postMessage(message, origin)
  reply({ kind: 'showcase-ack' }) // so the game knows this page shows it (and doesn't itself)
  try {
    const { openShowcase } = await importFromGame(module)
    showcase = openShowcase({
      image: options.image, mini: options.mini, title: String(options.title ?? ''),
      caption: options.caption && String(options.caption), collectable: options.collectable,
      from: onPage(options.from), home: onPage(options.home), area: showcaseArea,
      onReady: () => reply({ kind: 'showcase-ready' }),
      // Tapping A or B under the painting presses the Game Boy's button.
      onTap: (button: GameButton) => {
        sendToGame({ kind: 'button', button, down: true })
        setTimeout(() => sendToGame({ kind: 'button', button, down: false }), 60)
      },
      onClose: (choice: string) => {
        showcase = undefined
        reply({ kind: 'showcase-closed', choice })
      },
    })
  } catch {
    reply({ kind: 'showcase-closed', choice: 'leave' })
  }
}

/**
 * Where the painting may rest: never over the Game Boy's buttons, with room to spare, so on a
 * phone it never covers the controls you need to collect it or leave it. Of the free space above
 * the buttons, and beside the Game Boy (on a wide screen), it takes whichever fits it biggest.
 */
function showcaseArea(): Rect {
  const PADDING = 16
  const [w, h] = [window.innerWidth, window.innerHeight]
  const screen = game.getBoundingClientRect()
  const boxes = ['.controls', '.start-select']
    .map((selector) => document.querySelector(selector)?.getBoundingClientRect())
    .filter((box): box is DOMRect => !!box)
  const top = Math.min(h, ...boxes.map((box) => box.top)) - PADDING
  const left = Math.min(...boxes.map((box) => box.left), screen.left) - PADDING
  const right = Math.max(...boxes.map((box) => box.right), screen.right) + PADDING
  const candidates: Rect[] = [
    { x: 0, y: 0, width: w, height: Math.max(screen.bottom + 4, top) }, // above the buttons
    { x: 0, y: 0, width: Math.max(0, left), height: h }, // left of the Game Boy
    { x: right, y: 0, width: Math.max(0, w - right), height: h }, // right of it
  ]
  // How tall the painting could be in each (it's about 0.7 as wide as tall, with words under it).
  const fits = (r: Rect) => Math.min((r.height - 110) * 0.84, r.width * 0.78 / 0.7)
  return candidates.reduce((best, r) => (fits(r) > fits(best) * 1.15 ? r : best))
}

const BUTTON_ELEMENTS: Record<string, string> = {
  up: '.dpad .up', down: '.dpad .down', left: '.dpad .left', right: '.dpad .right',
  a: '.a-b .a', b: '.a-b .b', start: '.start-select .start', select: '.start-select .select',
}

/** Show a Game Boy button pressed or let go. */
function showPressed(button: string, down: boolean) {
  const selector = BUTTON_ELEMENTS[button]
  if (selector) document.querySelector(selector)?.classList.toggle('pressed', down)
}

init();
