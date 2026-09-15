import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fetch from "node-fetch";

import * as repository from "@modelcontextprotocol/server-github/dist/operations/repository.js";
import * as files from "@modelcontextprotocol/server-github/dist/operations/files.js";
import * as issues from "@modelcontextprotocol/server-github/dist/operations/issues.js";
import * as pulls from "@modelcontextprotocol/server-github/dist/operations/pulls.js";
import * as branches from "@modelcontextprotocol/server-github/dist/operations/branches.js";
import * as search from "@modelcontextprotocol/server-github/dist/operations/search.js";
import * as commits from "@modelcontextprotocol/server-github/dist/operations/commits.js";
import {
  GitHubValidationError,
  GitHubResourceNotFoundError,
  GitHubAuthenticationError,
  GitHubPermissionError,
  GitHubRateLimitError,
  GitHubConflictError,
  isGitHubError,
} from "@modelcontextprotocol/server-github/dist/common/errors.js";

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

function formatGitHubError(error) {
  let message = `GitHub API Error: ${error.message}`;
  if (error instanceof GitHubValidationError) {
    message = `Validation Error: ${error.message}`;
    if (error.response) {
      message += `\nDetails: ${JSON.stringify(error.response)}`;
    }
  } else if (error instanceof GitHubResourceNotFoundError) {
    message = `Not Found: ${error.message}`;
  } else if (error instanceof GitHubAuthenticationError) {
    message = `Authentication Failed: ${error.message}`;
  } else if (error instanceof GitHubPermissionError) {
    message = `Permission Denied: ${error.message}`;
  } else if (error instanceof GitHubRateLimitError) {
    message = `Rate Limit Exceeded: ${error.message}\nResets at: ${error.resetAt?.toISOString?.() || error.resetAt}`;
  } else if (error instanceof GitHubConflictError) {
    message = `Conflict: ${error.message}`;
  }
  return message;
}

export const githubTools = [
  {
    name: "create_or_update_file",
    description: "Create or update a single file in a GitHub repository",
    inputSchema: zodToJsonSchema(files.CreateOrUpdateFileSchema),
  },
  {
    name: "search_repositories",
    description: "Search for GitHub repositories",
    inputSchema: zodToJsonSchema(repository.SearchRepositoriesSchema),
  },
  {
    name: "create_repository",
    description: "Create a new GitHub repository in your account",
    inputSchema: zodToJsonSchema(repository.CreateRepositoryOptionsSchema),
  },
  {
    name: "get_file_contents",
    description: "Get the contents of a file or directory from a GitHub repository",
    inputSchema: zodToJsonSchema(files.GetFileContentsSchema),
  },
  {
    name: "push_files",
    description: "Push multiple files to a GitHub repository in a single commit",
    inputSchema: zodToJsonSchema(files.PushFilesSchema),
  },
  {
    name: "create_issue",
    description: "Create a new issue in a GitHub repository",
    inputSchema: zodToJsonSchema(issues.CreateIssueSchema),
  },
  {
    name: "create_pull_request",
    description: "Create a new pull request in a GitHub repository",
    inputSchema: zodToJsonSchema(pulls.CreatePullRequestSchema),
  },
  {
    name: "fork_repository",
    description: "Fork a GitHub repository to your account or specified organization",
    inputSchema: zodToJsonSchema(repository.ForkRepositorySchema),
  },
  {
    name: "create_branch",
    description: "Create a new branch in a GitHub repository",
    inputSchema: zodToJsonSchema(branches.CreateBranchSchema),
  },
  {
    name: "list_commits",
    description: "Get list of commits of a branch in a GitHub repository",
    inputSchema: zodToJsonSchema(commits.ListCommitsSchema),
  },
  {
    name: "list_issues",
    description: "List issues in a GitHub repository with filtering options",
    inputSchema: zodToJsonSchema(issues.ListIssuesOptionsSchema),
  },
  {
    name: "update_issue",
    description: "Update an existing issue in a GitHub repository",
    inputSchema: zodToJsonSchema(issues.UpdateIssueOptionsSchema),
  },
  {
    name: "add_issue_comment",
    description: "Add a comment to an existing issue",
    inputSchema: zodToJsonSchema(issues.IssueCommentSchema),
  },
  {
    name: "search_code",
    description: "Search for code across GitHub repositories",
    inputSchema: zodToJsonSchema(search.SearchCodeSchema),
  },
  {
    name: "search_issues",
    description: "Search for issues and pull requests across GitHub repositories",
    inputSchema: zodToJsonSchema(search.SearchIssuesSchema),
  },
  {
    name: "search_users",
    description: "Search for users on GitHub",
    inputSchema: zodToJsonSchema(search.SearchUsersSchema),
  },
  {
    name: "get_issue",
    description: "Get details of a specific issue in a GitHub repository",
    inputSchema: zodToJsonSchema(issues.GetIssueSchema),
  },
  {
    name: "get_pull_request",
    description: "Get details of a specific pull request",
    inputSchema: zodToJsonSchema(pulls.GetPullRequestSchema),
  },
  {
    name: "list_pull_requests",
    description: "List and filter repository pull requests",
    inputSchema: zodToJsonSchema(pulls.ListPullRequestsSchema),
  },
  {
    name: "create_pull_request_review",
    description: "Create a review on a pull request",
    inputSchema: zodToJsonSchema(pulls.CreatePullRequestReviewSchema),
  },
  {
    name: "merge_pull_request",
    description: "Merge a pull request",
    inputSchema: zodToJsonSchema(pulls.MergePullRequestSchema),
  },
  {
    name: "get_pull_request_files",
    description: "Get the list of files changed in a pull request",
    inputSchema: zodToJsonSchema(pulls.GetPullRequestFilesSchema),
  },
  {
    name: "get_pull_request_status",
    description: "Get the combined status of all status checks for a pull request",
    inputSchema: zodToJsonSchema(pulls.GetPullRequestStatusSchema),
  },
  {
    name: "update_pull_request_branch",
    description: "Update a pull request branch with the latest changes from the base branch",
    inputSchema: zodToJsonSchema(pulls.UpdatePullRequestBranchSchema),
  },
  {
    name: "get_pull_request_comments",
    description: "Get the review comments on a pull request",
    inputSchema: zodToJsonSchema(pulls.GetPullRequestCommentsSchema),
  },
  {
    name: "get_pull_request_reviews",
    description: "Get the reviews on a pull request",
    inputSchema: zodToJsonSchema(pulls.GetPullRequestReviewsSchema),
  },
];

export async function handleGitHubTool(name, rawArgs) {
  try {
    switch (name) {
      case "fork_repository": {
        const args = repository.ForkRepositorySchema.parse(rawArgs);
        const fork = await repository.forkRepository(args.owner, args.repo, args.organization);
        return { content: [{ type: "text", text: JSON.stringify(fork, null, 2) }] };
      }
      case "create_branch": {
        const args = branches.CreateBranchSchema.parse(rawArgs);
        const branch = await branches.createBranchFromRef(args.owner, args.repo, args.branch, args.from_branch);
        return { content: [{ type: "text", text: JSON.stringify(branch, null, 2) }] };
      }
      case "search_repositories": {
        const args = repository.SearchRepositoriesSchema.parse(rawArgs);
        const results = await repository.searchRepositories(args.query, args.page, args.perPage);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
      case "create_repository": {
        const args = repository.CreateRepositoryOptionsSchema.parse(rawArgs);
        const result = await repository.createRepository(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_file_contents": {
        const args = files.GetFileContentsSchema.parse(rawArgs);
        const contents = await files.getFileContents(args.owner, args.repo, args.path, args.branch);
        return { content: [{ type: "text", text: JSON.stringify(contents, null, 2) }] };
      }
      case "create_or_update_file": {
        const args = files.CreateOrUpdateFileSchema.parse(rawArgs);
        const result = await files.createOrUpdateFile(
          args.owner,
          args.repo,
          args.path,
          args.content,
          args.message,
          args.branch,
          args.sha
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "push_files": {
        const args = files.PushFilesSchema.parse(rawArgs);
        const result = await files.pushFiles(args.owner, args.repo, args.branch, args.files, args.message);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "create_issue": {
        const args = issues.CreateIssueSchema.parse(rawArgs);
        const { owner, repo, ...options } = args;
        const issue = await issues.createIssue(owner, repo, options);
        return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
      }
      case "create_pull_request": {
        const args = pulls.CreatePullRequestSchema.parse(rawArgs);
        const pullRequest = await pulls.createPullRequest(args);
        return { content: [{ type: "text", text: JSON.stringify(pullRequest, null, 2) }] };
      }
      case "search_code": {
        const args = search.SearchCodeSchema.parse(rawArgs);
        const results = await search.searchCode(args);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
      case "search_issues": {
        const args = search.SearchIssuesSchema.parse(rawArgs);
        const results = await search.searchIssues(args);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
      case "search_users": {
        const args = search.SearchUsersSchema.parse(rawArgs);
        const results = await search.searchUsers(args);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
      case "list_issues": {
        const args = issues.ListIssuesOptionsSchema.parse(rawArgs);
        const { owner, repo, ...options } = args;
        const result = await issues.listIssues(owner, repo, options);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "update_issue": {
        const args = issues.UpdateIssueOptionsSchema.parse(rawArgs);
        const { owner, repo, issue_number, ...options } = args;
        const result = await issues.updateIssue(owner, repo, issue_number, options);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "add_issue_comment": {
        const args = issues.IssueCommentSchema.parse(rawArgs);
        const { owner, repo, issue_number, body } = args;
        const result = await issues.addIssueComment(owner, repo, issue_number, body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "list_commits": {
        const args = commits.ListCommitsSchema.parse(rawArgs);
        const results = await commits.listCommits(args.owner, args.repo, args.page, args.perPage, args.sha);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }
      case "get_issue": {
        const args = issues.GetIssueSchema.parse(rawArgs);
        const issue = await issues.getIssue(args.owner, args.repo, args.issue_number);
        return { content: [{ type: "text", text: JSON.stringify(issue, null, 2) }] };
      }
      case "get_pull_request": {
        const args = pulls.GetPullRequestSchema.parse(rawArgs);
        const pullRequest = await pulls.getPullRequest(args.owner, args.repo, args.pull_number);
        return { content: [{ type: "text", text: JSON.stringify(pullRequest, null, 2) }] };
      }
      case "list_pull_requests": {
        const args = pulls.ListPullRequestsSchema.parse(rawArgs);
        const { owner, repo, ...options } = args;
        const pullRequests = await pulls.listPullRequests(owner, repo, options);
        return { content: [{ type: "text", text: JSON.stringify(pullRequests, null, 2) }] };
      }
      case "create_pull_request_review": {
        const args = pulls.CreatePullRequestReviewSchema.parse(rawArgs);
        const review = await pulls.createPullRequestReview(
          args.owner,
          args.repo,
          args.pull_number,
          args.event,
          args.body,
          args.comments
        );
        return { content: [{ type: "text", text: JSON.stringify(review, null, 2) }] };
      }
      case "merge_pull_request": {
        const args = pulls.MergePullRequestSchema.parse(rawArgs);
        const result = await pulls.mergePullRequest(
          args.owner,
          args.repo,
          args.pull_number,
          args.commit_title,
          args.commit_message,
          args.merge_method
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "get_pull_request_files": {
        const args = pulls.GetPullRequestFilesSchema.parse(rawArgs);
        const filesList = await pulls.getPullRequestFiles(args.owner, args.repo, args.pull_number);
        return { content: [{ type: "text", text: JSON.stringify(filesList, null, 2) }] };
      }
      case "get_pull_request_status": {
        const args = pulls.GetPullRequestStatusSchema.parse(rawArgs);
        const status = await pulls.getPullRequestStatus(args.owner, args.repo, args.pull_number);
        return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
      }
      case "update_pull_request_branch": {
        const args = pulls.UpdatePullRequestBranchSchema.parse(rawArgs);
        const { owner, repo, pull_number, expected_head_sha } = args;
        await pulls.updatePullRequestBranch(owner, repo, pull_number, expected_head_sha);
        return { content: [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }] };
      }
      case "get_pull_request_comments": {
        const args = pulls.GetPullRequestCommentsSchema.parse(rawArgs);
        const comments = await pulls.getPullRequestComments(args.owner, args.repo, args.pull_number);
        return { content: [{ type: "text", text: JSON.stringify(comments, null, 2) }] };
      }
      case "get_pull_request_reviews": {
        const args = pulls.GetPullRequestReviewsSchema.parse(rawArgs);
        const reviews = await pulls.getPullRequestReviews(args.owner, args.repo, args.pull_number);
        return { content: [{ type: "text", text: JSON.stringify(reviews, null, 2) }] };
      }
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid GitHub tool input: ${JSON.stringify(error.errors)}`);
    }
    if (isGitHubError(error)) {
      throw new Error(formatGitHubError(error));
    }
    throw error;
  }
}
