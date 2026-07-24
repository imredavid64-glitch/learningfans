import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"

describe("smoke", () => {
  it("runs a basic test", () => {
    render(<div data-testid="hello">Hello</div>)
    expect(screen.getByTestId("hello")).toHaveTextContent("Hello")
  })
})
