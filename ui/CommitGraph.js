/**
 * CommitGraph.js
 * Visualizes the GitRepository commit history using D3.js.
 * Renders a subway-style branching graph.
 */

export class CommitGraph {
  constructor(repo, containerId) {
    this.repo = repo;
    this.containerId = containerId;
    this.lm = window.levelManager; // Fallback access
    
    // Bind to repo events to redraw automatically
    const events = ['commit', 'branch', 'checkout', 'merge', 'reset', 'repositoryChanged'];
    events.forEach(e => this.repo.on(e, () => this.render()));
    
    // Bind to levelManager to restore canvas after HintPanel re-renders it
    if (this.lm) {
        this.lm.on('levelChanged', () => setTimeout(() => this.render(), 50));
        this.lm.on('reset', () => setTimeout(() => this.render(), 50));
    }
  }

  render() {
    const container = document.getElementById(this.containerId);
    if (!container || !window.d3) return;

    // Clear previous
    container.innerHTML = '';
    
    const commits = this.repo.commits;
    const branches = this.repo.branches;
    
    if (commits.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); font-style: italic; font-size: 0.8rem; padding-top: 10px;">(No commits yet. Create a commit to see the graph.)</div>';
      return;
    }

    const width = container.clientWidth || 250;
    // Calculate height based on number of commits
    const height = Math.max(200, commits.length * 40 + 40);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .style('padding', '10px 0');

    // Layout configuration
    const nodeRadius = 8;
    const xSpacing = 30;
    const ySpacing = 40;
    const startX = 20;
    let startY = height - 20; // Bottom-up drawing

    // Determine branch lanes
    const branchLanes = {}; // { branchName: laneIndex }
    let currentLane = 0;
    
    // We need to trace commits from HEAD downwards, or just sort them by timestamp.
    // In our sim, commits are pushed in order, so index represents chronological order.
    // For a realistic graph, we draw them vertically.
    
    const nodes = commits.map((commit, i) => {
      if (branchLanes[commit.branch] === undefined) {
        branchLanes[commit.branch] = currentLane++;
      }
      return {
        ...commit,
        lane: branchLanes[commit.branch],
        y: startY - (i * ySpacing), 
        index: i
      };
    });

    // Create links
    const links = [];
    nodes.forEach(node => {
      if (node.parent) {
        const parentNode = nodes.find(n => n.hash === node.parent);
        if (parentNode) {
          links.push({ source: node, target: parentNode, type: 'primary' });
        }
      }
      if (node.parent2) {
        const parentNode2 = nodes.find(n => n.hash === node.parent2);
        if (parentNode2) {
          links.push({ source: node, target: parentNode2, type: 'merge' });
        }
      }
    });

    // Draw links (paths)
    svg.selectAll('.link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d => {
        const sx = startX + (d.source.lane * xSpacing);
        const sy = d.source.y;
        const tx = startX + (d.target.lane * xSpacing);
        const ty = d.target.y;
        // Curve
        return `M${sx},${sy} C${sx},${sy + 20} ${tx},${ty - 20} ${tx},${ty}`;
      })
      .style('fill', 'none')
      .style('stroke', d => d.type === 'merge' ? 'var(--accent-purple)' : 'var(--text-muted)')
      .style('stroke-width', 2);

    // Draw nodes
    const nodeGroups = svg.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${startX + (d.lane * xSpacing)}, ${d.y})`);

    nodeGroups.append('circle')
      .attr('r', nodeRadius)
      .style('fill', d => {
        // Highlight HEAD
        if (this.repo.HEAD.ref === d.hash || (this.repo.HEAD.type === 'branch' && this.repo.branches[this.repo.HEAD.ref] === d.hash)) {
          return 'var(--accent-green)';
        }
        return 'var(--bg-elevated)';
      })
      .style('stroke', 'var(--accent-green)')
      .style('stroke-width', 2);

    // Labels
    nodeGroups.append('text')
      .attr('x', d => (currentLane * xSpacing) + 15) // Push text past all lanes
      .attr('y', 4)
      .style('fill', 'var(--text-primary)')
      .style('font-size', '11px')
      .style('font-family', 'var(--font-mono)')
      .text(d => d.shortHash + ' ' + d.message.substring(0, 15) + (d.message.length > 15 ? '...' : ''));

    // Branch labels
    const branchPointers = [];
    for (const [bName, bHash] of Object.entries(branches)) {
      if (bHash) {
        const targetNode = nodes.find(n => n.hash === bHash);
        if (targetNode) {
          branchPointers.push({ name: bName, node: targetNode });
        }
      }
    }

    // Group labels pointing to the same node
    const groupedPointers = d3.group(branchPointers, d => d.node.hash);

    svg.selectAll('.branch-label')
        .data(Array.from(groupedPointers))
        .enter()
        .append('text')
        .attr('class', 'branch-label')
        .attr('x', d => {
            const laneCount = currentLane;
            return startX + (laneCount * xSpacing) + 150;
        })
        .attr('y', d => d[1][0].node.y + 4)
        .style('fill', d => {
            const names = d[1].map(b => b.name);
            return names.includes(this.repo.currentBranch) ? 'var(--accent-blue)' : 'var(--accent-purple)';
        })
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .text(d => {
            const names = d[1].map(b => b.name);
            let headTag = '';
            if (this.repo.HEAD.type === 'branch' && names.includes(this.repo.HEAD.ref)) {
                headTag = 'HEAD -> ';
            }
            return `(${headTag}${names.join(', ')})`;
        });
  }
}
