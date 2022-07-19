/**
 * @alias fluro.device
 * @classdesc A static this that provides device and screen information.
 * @class
 * @hideconstructor
 */
export default class FluroDevice {
  mounted = false
  screen = {
    width: 1024,
    height: 768
  }

  limits = {
    xs: 600,
    sm: 960,
    md: 1264,
    lg: 1904
  }

  breakpoint = {
    mobile: false,
    tablet: false,
    desktop: false,
    xs: false,
    sm: false,
    md: false,
    lg: false,
    xl: false,
    xsOnly: false,
    smOnly: false,
    smAndDown: false,
    smAndUp: false,
    mdOnly: false,
    mdAndDown: false,
    mdAndUp: false,
    lgOnly: false,
    lgAndDown: false,
    lgAndUp: false,
    xlOnly: false,
    point: 0
  }

  WindowReference
  point

  resize() {
    const width = Math.max(this.WindowReference.innerWidth || 0)
    const height = Math.max(this.WindowReference.innerHeight || 0)

    this.screen = {
      width,
      height
    }

    const breakpoint = {
      mobile: false,
      tablet: false,
      desktop: false,
      xs: false,
      sm: false,
      md: false,
      lg: false,
      xl: false,
      xsOnly: false,
      smOnly: false,
      smAndDown: false,
      smAndUp: false,
      mdOnly: false,
      mdAndDown: false,
      mdAndUp: false,
      lgOnly: false,
      lgAndDown: false,
      lgAndUp: false,
      xlOnly: false,
      point: 0
    }

    let point = 0
    if (width > this.limits.xs) {
      point++
    }
    if (width > this.limits.sm) {
      point++
    }
    if (width > this.limits.md) {
      point++
    }
    if (width > this.limits.lg) {
      point++
    }

    // XS Mobile
    if (point < 1) {
      breakpoint.mobile = true
      breakpoint.xs = true
      breakpoint.xsOnly = true
      // Down
      breakpoint.smAndDown = true
      breakpoint.mdAndDown = true
      breakpoint.lgAndDown = true
    }
    // SM Tablet
    if (point === 1) {
      breakpoint.tablet = true
      breakpoint.sm = true
      breakpoint.smOnly = true
      // Down
      breakpoint.smAndDown = true
      breakpoint.mdAndDown = true
      breakpoint.lgAndDown = true
      // Up
      breakpoint.smAndUp = true
    }
    // MD Tablet
    if (point === 2) {
      breakpoint.desktop = true
      breakpoint.md = true
      breakpoint.mdOnly = true
      // Down
      breakpoint.mdAndDown = true
      breakpoint.lgAndDown = true
      // Up
      breakpoint.smAndUp = true
      breakpoint.mdAndUp = true
    }
    // LG Desktop
    if (point === 3) {
      breakpoint.desktop = true
      breakpoint.lg = true
      breakpoint.lgOnly = true
      // Down
      breakpoint.lgAndDown = true
      // Up
      breakpoint.smAndUp = true
      breakpoint.mdAndUp = true
      breakpoint.lgAndUp = true
    }
    // XL Desktop
    if (point > 3) {
      breakpoint.desktop = true
      breakpoint.xl = true
      breakpoint.xlOnly = true
      // Up
      breakpoint.smAndUp = true
      breakpoint.mdAndUp = true
      breakpoint.lgAndUp = true
    }
    this.point = point
    this.breakpoint = breakpoint
  }

  mount(window) {
    if (this.mounted) {
      console.log('already mounted')
      return
    }
    this.WindowReference = window
    this.resize()
    this.mounted = true
    this.WindowReference.addEventListener('resize', this.resize)
  }

  destroy() {
    this.WindowReference.removeEventListener('resize', this.resize)
    this.WindowReference = undefined
    this.mounted = false
  }
  // if (!(typeof window === 'undefined')) {
  //     this.mount(window);
  // }
}
