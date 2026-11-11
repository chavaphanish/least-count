import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from 'react'
import type {
  SubmitEvent,
  FormHTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react'
import { useAppViewport } from './MobileOrientation'
function flatten(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) &&
    typeof child.type === 'symbol'
      ? flatten(child.props.children)
      : [child],
  )
}
function disable(node: ReactNode, off: boolean): ReactNode {
  if (!isValidElement<{ children?: ReactNode; disabled?: boolean }>(node))
    return node
  if (
    typeof node.type !== 'string' ||
    ['input', 'select', 'textarea'].includes(String(node.type))
  )
    return cloneElement(node, { disabled: off || node.props.disabled })
  return node.props.children
    ? cloneElement(node, {
        children: Children.map(node.props.children, (c) => disable(c, off)),
      })
    : node
}
/** Field steps exist only while a mobile keyboard reduces the available surface. */
export function CompactForm({
  children,
  onSubmit,
  onFocusCapture,
  shortSteps = false,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { shortSteps?: boolean }) {
  const { mobile, keyboard, height } = useAppViewport()
  const ref = useRef<HTMLFormElement>(null)
  const [step, setStep] = useState(0)
  const nodes = flatten(children),
    fields = nodes.filter(
      (n) =>
        isValidElement<{ 'data-form-field'?: boolean }>(n) &&
        (n.type === 'label' || n.props['data-form-field']),
    )
  useEffect(() => setStep(0), [fields.length])
  const wizard =
    mobile &&
    (keyboard ||
      height < 250 ||
      (shortSteps && height < 390 && fields.length > 2)) &&
    fields.length > 1
  const current = Math.min(step, fields.length - 1)
  const advance = () => {
    if (props.noValidate || ref.current?.reportValidity()) setStep(current + 1)
  }
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    if (wizard && current < fields.length - 1) {
      event.preventDefault()
      advance()
      return
    }
    if (wizard && !props.noValidate) {
      const inputs = Array.from(
        ref.current!.querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >('input,select,textarea'),
      )
      for (const input of inputs) {
        const wasDisabled = input.disabled
        input.disabled = false
        const valid = input.checkValidity()
        input.disabled = wasDisabled
        if (!valid) {
          event.preventDefault()
          const labels = Array.from(ref.current!.querySelectorAll('label'))
          setStep(labels.findIndex((label) => label.contains(input)))
          requestAnimationFrame(() => {
            input.focus()
            input.reportValidity()
          })
          return
        }
      }
    }
    onSubmit?.(event)
  }
  return (
    <form
      {...props}
      ref={ref}
      onSubmit={submit}
      onFocusCapture={(event) => {
        const labels = Array.from(ref.current?.querySelectorAll('label') ?? [])
        const index = labels.findIndex((label) => label.contains(event.target))
        if (index >= 0) setStep(index)
        onFocusCapture?.(event)
      }}
      data-form-steps={wizard || undefined}
    >
      {nodes.map((node, i) => {
        if (!mobile || !isValidElement(node))
          return <Fragment key={i}>{node}</Fragment>
        const index = fields.indexOf(node)
        if (index >= 0)
          return (
            <div
              key={i}
              className="form-field"
              hidden={wizard && index !== current}
            >
              {disable(node, wizard && index !== current)}
            </div>
          )
        const button = node as ReactElement<{
          type?: string
          children?: ReactNode
          className?: string
        }>
        if (
          (node.type === 'button' &&
            (!button.props.type || button.props.type === 'submit')) ||
          button.props.className?.split(' ').includes('auth-actions')
        )
          return (
            <span
              className="form-contents form-submit"
              key={i}
              hidden={wizard && current < fields.length - 1}
            >
              {node}
            </span>
          )
        return <Fragment key={i}>{node}</Fragment>
      })}
      {wizard && (
        <nav className="field-steps" aria-label="Form fields">
          <button
            type="button"
            disabled={!current}
            onClick={() => setStep(current - 1)}
          >
            Previous field
          </button>
          <span>
            {current + 1}/{fields.length}
          </span>
          {current < fields.length - 1 && (
            <button type="button" onClick={advance}>
              Next field
            </button>
          )}
        </nav>
      )}
    </form>
  )
}
