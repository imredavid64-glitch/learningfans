import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"

function renderCard(overrides = {}) {
  return render(<Card data-testid="card" {...overrides} />)
}

describe("Card", () => {
  it("renders children", () => {
    render(<Card><p>hello</p></Card>)
    expect(screen.getByText("hello")).toBeInTheDocument()
  })

  it("has data-slot attribute", () => {
    renderCard()
    expect(screen.getByTestId("card")).toHaveAttribute("data-slot", "card")
  })

  it("accepts custom className", () => {
    renderCard({ className: "my-class" })
    expect(screen.getByTestId("card")).toHaveClass("my-class")
  })

  it("default size is default", () => {
    renderCard()
    expect(screen.getByTestId("card")).toHaveAttribute("data-size", "default")
  })

  it("applies sm size", () => {
    renderCard({ size: "sm" })
    expect(screen.getByTestId("card")).toHaveAttribute("data-size", "sm")
  })
})

describe("CardHeader", () => {
  it("renders children and className", () => {
    render(<CardHeader className="extra">Header</CardHeader>)
    const el = screen.getByText("Header")
    expect(el).toHaveClass("extra")
    expect(el).toHaveAttribute("data-slot", "card-header")
  })
})

describe("Card composition", () => {
  it("renders a complete card", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText("Title")).toBeInTheDocument()
    expect(screen.getByText("Content")).toBeInTheDocument()
    expect(screen.getByText("Footer")).toBeInTheDocument()
  })
})
