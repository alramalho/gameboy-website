import { Queue } from "./queue";

/**
 * The Game Boy is a frame around the game (alramalho/pokemon-website), which runs
 * in an iframe in the screen. Its D-pad, A and B are the game's buttons: pressing
 * one sends it to the game, and letting go releases it, so holding a direction keeps
 * walking. START shows the help menu and SELECT flashes the Game Boy's colour.
 */

// Where the game is served: pokemon.alexramalho.dev (Vercel project pokemon-website), or the
// game's dev server while developing. GAME_URL overrides it (e.g. GAME_URL=http://localhost:4000 yarn start).
const GAME_URL = process.env.GAME_URL
  || (process.env.NODE_ENV === "production" ? "https://pokemon.alexramalho.dev" : "http://localhost:5188");

type GameButton = "up" | "down" | "left" | "right" | "a" | "b"
type Action = GameButton | "select" | "start"

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
    case "start":
      toggleHelpMenu()
      break
    case "select":
      triggerKonami()
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
    const isGameButton = action != "select" && action != "start"
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

  const DPADWrapper = document.querySelector('.dpad')
  DPADWrapper.appendChild(createButton("up", '<i class="fa fa-caret-up">', 'up'))
  DPADWrapper.appendChild(createButton("left", '<i class="fa fa-caret-left">', 'left'))
  DPADWrapper.appendChild(createButton("right", '<i class="fa fa-caret-right">', 'right'))
  DPADWrapper.appendChild(createButton("down", '<i class="fa fa-caret-down">', 'down'))
  const middle = document.createElement('div')
  middle.className = 'middle'
  DPADWrapper.appendChild(middle)

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
    KeyZ: 'a', Enter: 'a', KeyX: 'b', Escape: 'b', Backspace: 'b',
    ShiftRight: 'select', ShiftLeft: 'select', KeyH: 'start',
  }
  document.addEventListener('keydown', (event) => {
    const action = KEY_ACTIONS[event.code]
    if (action || event.code == 'Space' || /^Key[WASD]$/.test(event.code)) event.preventDefault()
    if (event.repeat) return
    sendToGame({ kind: 'key', code: event.code, down: true })
    if (action) fireControl(action)
    if (action == 'start' || action == 'select') showPressed(action, true)
  })
  document.addEventListener('keyup', (event) => {
    sendToGame({ kind: 'key', code: event.code, down: false })
    const action = KEY_ACTIONS[event.code]
    if (action == 'start' || action == 'select') showPressed(action, false)
  })

  // The game says whenever one of its buttons goes down or up, whether a key or a Game Boy
  // button did it, so the Game Boy shows it pressed: the arrows light up the D-pad, Z the A...
  window.addEventListener('message', (event) => {
    if (event.source !== game.contentWindow || event.data?.kind !== 'held') return
    showPressed(event.data.button, !!event.data.down)
  })
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
