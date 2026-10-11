import {
  Badge, Button, Card, Container, Group, NumberInput, Select, Stack, Table,
  Text, Textarea, Title,
} from "@mantine/core";
import { useState } from "react";

import { http } from "../../../lib/http";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type Props = { tasksOnly?: boolean; adminOnly?: boolean };
type Leave = {
  id: number; category: string; start_date: string; end_date: string;
  purpose: string; state: string; chargeable_days: string;
};
type Balance = { category: string; year: number; balance: string; carried: string };

const leaveStates: Record<string, string> = {
  awaiting_substitute: "Awaiting substitute",
  applicant_action: "Applicant action required",
  unit_head_review: "Unit Head review",
  establishment_routing: "Establishment routing",
  final_sanction: "Final sanction",
  director_self_sanction: "Director self-sanction",
  approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn",
  cancelled: "Cancelled", resumption_review: "Resumption review",
};

export default function LeavePage({ tasksOnly = false, adminOnly = false }: Props) {
  const qc = useQueryClient();
  const [category, setCategory] = useState("CL");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [half, setHalf] = useState("");
  const [purpose, setPurpose] = useState("");
  const [substitute, setSubstitute] = useState<number | "">("");
  const applications = useQuery({
    queryKey: ["leave", tasksOnly ? "tasks" : "mine"],
    queryFn: async () => (await http.get<{ results: Leave[] }>("/leave/applications")).data,
  });
  const balances = useQuery({
    queryKey: ["leave", "balances"],
    queryFn: async () => (await http.get<Balance[]>("/leave/balances")).data,
    enabled: !tasksOnly && !adminOnly,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["leave"] });
  const submit = useMutation({
    mutationFn: () => http.post("/leave/applications", {
      category, start_date: start, end_date: end, half,
      purpose, ...(substitute === "" ? {} : { substitute_user_id: substitute }),
    }),
    onSuccess: () => { invalidate(); setPurpose(""); setSubstitute(""); },
  });
  const decide = useMutation({
    mutationFn: ({ id, outcome, recommendation }: {
      id: number; outcome: string; recommendation?: string;
    }) => http.post(`/leave/applications/${id}/decision`, {
      outcome, recommendation, reason: "",
    }),
    onSuccess: invalidate,
  });
  const withdraw = useMutation({
    mutationFn: (id: number) => http.post(`/leave/applications/${id}/withdraw`, {}),
    onSuccess: invalidate,
  });

  if (adminOnly) {
    return <Container size="lg">
      <Title order={2} mt="xl">Leave administration</Title>
      <Text c="dimmed" mt="sm">
        Policy, hierarchy, holiday/RH calendar, offline synchronization, and SLA operations
        are available through the protected ELM administration API.
      </Text>
    </Container>;
  }

  const rows = applications.data?.results ?? [];
  return <Container size="lg">
    <Title order={2} mt="xl">{tasksOnly ? "Leave tasks" : "Employee Leave"}</Title>
    {!tasksOnly && <>
      <Group align="stretch" mt="lg">
        {(balances.data ?? []).map((balance) => <Card key={balance.category} withBorder p="sm">
          <Text size="xs" c="dimmed">{balance.category} · {balance.year}</Text>
          <Text fw={700} size="lg">{balance.balance} days</Text>
        </Card>)}
      </Group>
      <Card withBorder mt="lg">
        <Title order={4}>New application</Title>
        <Stack mt="md">
          <Select label="Category" data={["CL", "RH", "SCL", "EL", "COL", "VL"]}
            value={category} onChange={(value) => setCategory(value ?? "CL")} />
          {category === "CL" && <Select label="Half day (optional)" clearable
            data={[{ value: "first", label: "First half" }, { value: "second", label: "Second half" }]}
            value={half || null} onChange={(value) => setHalf(value ?? "")} />}
          <Group grow>
            <input aria-label="Start date" type="date" value={start}
              onChange={(event) => setStart(event.currentTarget.value)} />
            <input aria-label="End date" type="date" value={end}
              onChange={(event) => setEnd(event.currentTarget.value)} />
          </Group>
          <NumberInput label="Substitute user id (optional)" value={substitute}
            onChange={(value) => setSubstitute(typeof value === "number" ? value : "")} />
          <Textarea label="Purpose / reason" value={purpose}
            onChange={(event) => setPurpose(event.currentTarget.value)} />
          <Button onClick={() => submit.mutate()} loading={submit.isPending}
            disabled={!start || !end || !purpose}>Submit application</Button>
        </Stack>
      </Card>
    </>}
    <Card withBorder mt="lg">
      <Title order={4}>{tasksOnly ? "Assigned requests" : "My leave history"}</Title>
      <Table mt="md" striped highlightOnHover>
        <Table.Thead><Table.Tr><Table.Th>Category</Table.Th><Table.Th>Period</Table.Th>
          <Table.Th>Status</Table.Th><Table.Th>Days</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>{rows.map((row) => <Table.Tr key={row.id}>
          <Table.Td>{row.category}</Table.Td>
          <Table.Td>{row.start_date} to {row.end_date}</Table.Td>
          <Table.Td><Badge>{leaveStates[row.state] ?? row.state}</Badge></Table.Td>
          <Table.Td>{row.chargeable_days}</Table.Td>
          <Table.Td><Group gap="xs">
            {tasksOnly && row.state === "unit_head_review" && row.category in { CL: 1, RH: 1 } && <>
              <Button size="xs" onClick={() => decide.mutate({ id: row.id, outcome: "approve" })}>Approve</Button>
              <Button size="xs" color="red" onClick={() => decide.mutate({ id: row.id, outcome: "reject" })}>Reject</Button>
            </>}
            {tasksOnly && row.state === "unit_head_review" && !(row.category in { CL: 1, RH: 1 }) && <>
              <Button size="xs" onClick={() => decide.mutate({ id: row.id, outcome: "approve", recommendation: "recommended" })}>Recommend</Button>
              <Button size="xs" color="orange" onClick={() => decide.mutate({ id: row.id, outcome: "approve", recommendation: "not_recommended" })}>Not recommend</Button>
            </>}
            {tasksOnly && ["final_sanction", "director_self_sanction"].includes(row.state) && <>
              <Button size="xs" onClick={() => decide.mutate({ id: row.id, outcome: "approve" })}>Sanction</Button>
              <Button size="xs" color="red" onClick={() => decide.mutate({ id: row.id, outcome: "reject" })}>Reject</Button>
            </>}
            {!tasksOnly && ["awaiting_substitute", "applicant_action", "unit_head_review", "establishment_routing", "final_sanction", "director_self_sanction"].includes(row.state) &&
              <Button size="xs" color="red" variant="light" onClick={() => withdraw.mutate(row.id)}>Withdraw</Button>}
            <Button component="a" size="xs" variant="subtle" href={`/api/v1/leave/applications/${row.id}/export`}>Export</Button>
          </Group></Table.Td>
        </Table.Tr>)}</Table.Tbody>
      </Table>
    </Card>
  </Container>;
}
