# Community Feedback Playbook

Prepared responses for the top 5 frequently asked questions about licensing and trademark policy.

---

## Q1: Can I use this in my commercial product?

**Scenario:** Enterprise developer asking about embedding the engine in a proprietary SaaS product.

**Answer Template:**

> Yes, you absolutely can. The Apache 2.0 License (Section 2) grants you a perpetual, worldwide, non-exclusive, royalty-free license to use, modify, and distribute the software in any context — including commercial products.
>
> The trademark policy in `TRADEMARK.md` only restricts the use of the "Cognition Graph" brand name and logo in your product naming or marketing. Using the underlying code in your commercial product has no trademark implications as long as you do not misrepresent affiliation.
>
> For reference: *Section 2 of Apache 2.0 (Grant of Copyright License)* and *Section 6 (Trademarks)* explicitly separate software rights from trademark rights.

---

## Q2: Can I modify and redistribute the code?

**Scenario:** Contributor wanting to fork and republish.

**Answer Template:**

> Yes, Apache 2.0 (Section 4) permits you to reproduce, prepare derivative works, and distribute copies. You may add your own copyright statement to your modifications and may offer different license terms for your modifications — but the original work must remain under Apache 2.0.
>
> Key requirements:
> - Retain all original copyright, patent, trademark, and attribution notices.
> - Include a conspicuous notice that your version includes modifications.
> - If you include the "NOTICE" file (if any), do not modify it.

---

## Q3: How do I report a trademark violation?

**Scenario:** Someone is using "Cognition Graph" in a way that implies endorsement without permission.

**Answer Template:**

> Thank you for helping protect the project. Please:
>
> 1. Gather evidence: screenshot, URL, and a description of how the mark is being used.
> 2. Open a private report via email: **wind-come@qq.com**
> 3. Alternatively, open a GitHub Discussion in the "Q&A" category with a private note flag.
>
> We review reports within 5 business days. If a violation is confirmed, we will:
> - Issue a cease-and-desist notice to the infringing party.
> - Document the resolution in the project records (without exposing reporter identity).
>
> We reserve the right to escalate under applicable trademark law.

---

## Q4: Do I need to sign a CLA to contribute?

**Scenario:** New contributor asking about legal paperwork before submitting a PR.

**Answer Template:**

> No, you do not need to sign a separate Contributor License Agreement (CLA). Apache 2.0 (Section 5, Submission of Contributions) handles this automatically:
>
> *"Unless You explicitly state otherwise, any Contribution intentionally submitted for inclusion in the Work by You to the Licensor shall be under the terms and conditions of this License, without any additional terms or conditions."*
>
> This means:
> - By submitting a PR, you agree that your contribution is licensed under Apache 2.0.
> - You retain copyright over your contributions.
> - No additional CLA or legal agreement is required.
>
> If your organization requires a signed agreement for legal compliance, contact us at wind-come@qq.com to arrange a corporate CLA.

---

## Q5: What if my company requires GPL compatibility?

**Scenario:** Organization using GPL-licensed tools wanting to integrate this project.

**Answer Template:**

> Apache 2.0 is a permissive license and is compatible with GPLv3 (but not GPLv2). Specifically:
>
> - **Apache 2.0 → GPLv3:** Compatible. You can combine Apache 2.0 code with GPLv3 code.
> - **Apache 2.0 → GPLv2:** Not directly compatible. You cannot distribute Apache 2.0 code under GPLv2 alone.
>
> If your project is GPLv2-only, you have two options:
> 1. Keep the Apache 2.0 components as separate processes communicating via IPC/network (not derivative works).
> 2. Contact us at wind-come@qq.com to discuss alternative licensing arrangements.
>
> The core engines (cognition graph, MCP tools) will always remain Apache 2.0, but we are open to discussing dual-licensing for enterprise integration scenarios.

---

*Last updated: 2026-06-15*
